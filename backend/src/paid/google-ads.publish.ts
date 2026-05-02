/**
 * Publica uma campanha Search (local) no Google Ads via REST (mutate) e
 * grava os external_* na base.
 */
import type {
  PaidAdsEntityStatus as EntityStatus,
  PaidAdsMatchType as MatchType,
  PaidAdsPlatform as PaidPlatform,
} from "@prisma/client";

import { API_BASE, getAccessFromRefreshToken, getGoogleDeveloperToken } from "./google-ads.api";
import { humanizeGoogleAdsPublishError } from "./google-ads-errors";
import { GOOGLE_GEO_CRITERION_IDS, normalizeGoogleCountryCode } from "./geo-google";
import { googleCampaignCreateBiddingOneof } from "./google-campaign-bidding";
import { normalizeGoogleLanguageCode } from "./language-google";
import {
  publishGoogleCampaignAssetExtensions,
  readGoogleAssetExtensionsFromBidding,
} from "./google-ads-asset-extensions-publish";
import { prisma } from "./paidPrisma";

/** ISO-3166 alpha-2 → google geoTargetConstants/id (exportado também em geo-google.ts). */
const GEO_ID = GOOGLE_GEO_CRITERION_IDS;

const LANG_ID: Record<string, number> = {
  en: 1000,
  de: 1001,
  fr: 1002,
  es: 1003,
  it: 1004,
  ja: 1005,
  nl: 1010,
  pt: 1014,
  pl: 1045,
  sv: 1015,
  da: 1009,
  fi: 1011,
  no: 1012,
  cs: 1022,
  el: 1023,
  hu: 1024,
  ro: 1040,
  ru: 1031,
  tr: 1037,
  ko: 1018,
  zh: 1017,
  hi: 1020,
  ar: 1019,
};

function matchTypeToGoogle(m: MatchType): "EXACT" | "PHRASE" | "BROAD" {
  if (m === "exact") return "EXACT";
  if (m === "phrase") return "PHRASE";
  return "BROAD";
}

function parseJsonStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function lastId(resourceName: string): string {
  const parts = resourceName.split("/");
  return parts[parts.length - 1]! ?? resourceName;
}

function ensureUrl(u: string): string {
  const t = u.trim();
  if (!t) return "https://example.com";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isAbsoluteHttpUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function publishLog(level: "info" | "warn" | "error", event: string, data: Record<string, unknown>) {
  const row = { event, ...data };
  if (level === "error") console.error("[google.publish]", row);
  else if (level === "warn") console.warn("[google.publish]", row);
  else console.info("[google.publish]", row);
}

function campaignNameWithSuffix(baseName: string, attempt: number): string {
  if (attempt <= 0) return baseName.slice(0, 250);
  const suffix = ` (${Date.now().toString().slice(-6)}-${attempt})`;
  const maxBase = Math.max(1, 250 - suffix.length);
  return `${baseName.slice(0, maxBase)}${suffix}`;
}

function adGroupNameWithSuffix(baseName: string, attempt: number): string {
  if (attempt <= 0) return baseName.slice(0, 255);
  const suffix = ` (${attempt + 1})`;
  const maxBase = Math.max(1, 255 - suffix.length);
  return `${baseName.slice(0, maxBase)}${suffix}`;
}

function isDuplicateCampaignNameError(msg: string): boolean {
  const t = msg.toLowerCase();
  return (
    t.includes("name is already assigned") ||
    t.includes("duplicate") ||
    t.includes("already exists")
  );
}

/**
 * Junta detail `GoogleAdsFailure.errors[]` ao texto genérico da Google. Inclui:
 * - `message`
 * - `location.fieldPathElements[].fieldName` → indica **qual** o campo em falta/inválido
 * - `errorCode` → o nome curto do enum (ex.: REQUIRED_FIELD_MISSING)
 */
function enrichGoogleMutateError(raw: unknown): string {
  const root = raw as { error?: { message?: string; details?: unknown[] } };
  const base = root.error?.message ?? "Erro na Google Ads API.";
  const details = root.error?.details;
  const extras: string[] = [];

  if (Array.isArray(details)) {
    for (const d of details) {
      if (!d || typeof d !== "object") continue;
      const errs = (d as {
        errors?: Array<{
          message?: string;
          errorCode?: Record<string, unknown>;
          location?: { fieldPathElements?: Array<{ fieldName?: string; index?: number }> };
        }>;
      }).errors;
      if (!Array.isArray(errs)) continue;
      for (const e of errs) {
        const msg = (e.message ?? "").trim();
        const fieldPath = (e.location?.fieldPathElements ?? [])
          .map((p) => (p.index != null ? `${p.fieldName ?? "?"}[${p.index}]` : (p.fieldName ?? "?")))
          .filter(Boolean)
          .join(".");
        const codeName =
          e.errorCode && typeof e.errorCode === "object"
            ? Object.entries(e.errorCode as Record<string, unknown>).find(([, v]) => typeof v === "string")?.[1]
            : undefined;

        const parts: string[] = [];
        if (msg) parts.push(msg);
        if (fieldPath) parts.push(`(campo: ${fieldPath})`);
        if (typeof codeName === "string" && codeName.length > 0) parts.push(`[${codeName}]`);
        const combined = parts.join(" ").trim();
        if (combined && !extras.includes(combined)) extras.push(combined);
      }
    }
  }

  if (extras.length === 0) return base;
  return `${base} — ${extras.join("; ")}`;
}

const GOOGLE_MUTATE_MAX_ATTEMPTS = 4;
const GOOGLE_MUTATE_BASE_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resposta 429 pode incluir segundo a aguardar. */
function parseRetryAfterHeaderMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const sec = Number(raw.trim());
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.min(Math.round(sec * 1000), 60_000);
}

function shouldRetryMutateHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function mutate(
  accessToken: string,
  devToken: string,
  customerId: string,
  servicePath: string,
  body: object,
  loginCustomerId?: string,
): Promise<{ resourceNames: string[]; raw: unknown }> {
  const url = `${API_BASE}/customers/${customerId.replace(/\D/g, "")}/${servicePath}:mutate`;
  const serialized = JSON.stringify(body);

  let lastThrow: Error | undefined;
  for (let attempt = 0; attempt < GOOGLE_MUTATE_MAX_ATTEMPTS; attempt++) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": devToken,
      "Content-Type": "application/json",
    };
    if (loginCustomerId) {
      headers["login-customer-id"] = loginCustomerId.replace(/\D/g, "");
    }

    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body: serialized });
    } catch {
      lastThrow = lastThrow ?? new Error("Falha de rede ao contactar Google Ads.");
      if (attempt < GOOGLE_MUTATE_MAX_ATTEMPTS - 1) {
        const backoff = GOOGLE_MUTATE_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 200);
        await sleep(backoff);
        continue;
      }
      throw lastThrow;
    }

    const raw = (await res.json().catch(() => ({}))) as {
      results?: Array<{ resourceName?: string }>;
      error?: { message?: string; details?: unknown };
    };

    if (res.ok) {
      const resourceNames = (raw.results ?? [])
        .map((r) => r.resourceName)
        .filter((n): n is string => Boolean(n));
      return { resourceNames, raw };
    }

    const errMsg = enrichGoogleMutateError(raw);
    lastThrow = new Error(errMsg);

    const retryLater =
      attempt < GOOGLE_MUTATE_MAX_ATTEMPTS - 1 &&
      shouldRetryMutateHttpStatus(res.status);

    if (retryLater) {
      const headerWait = parseRetryAfterHeaderMs(res);
      const backoff =
        headerWait ?? GOOGLE_MUTATE_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 200);
      await sleep(backoff);
      continue;
    }

    throw lastThrow;
  }

  throw lastThrow ?? new Error("Erro na Google Ads API.");
}

export type GooglePublishResult = { ok: true } | { ok: false; error: string };

/**
 * Tenta publicar a campanha `google_ads` local; em caso de sucesso, actualiza
 * `external_*` e estados `live` nas linhas afectadas.
 */
export async function publishGoogleSearchCampaignFromLocal(
  projectId: string,
  campaignId: string,
  options: { platform?: PaidPlatform; loginCustomerId?: string } = {},
): Promise<GooglePublishResult> {
  const { platform, loginCustomerId: loginFromOpts } = options;
  const loginCustomerId =
    loginFromOpts?.replace(/\D/g, "") ||
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "") ||
    undefined;
  if (platform && platform !== "google_ads") {
    return { ok: false, error: "Esta publicação aplica-se apenas a Google Ads." };
  }

  const conn = await prisma.paidAdsGoogleAdsConnection.findUnique({
    where: { projectId },
  });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.googleCustomerId) {
    return { ok: false, error: "Ligue a conta Google Ads (OAuth) antes de publicar." };
  }

  const dev = getGoogleDeveloperToken();
  if (!dev) {
    return { ok: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN em falta." };
  }

  const campaign = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "google_ads" },
    include: {
      adGroups: { include: { keywords: true, adsRsa: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!campaign) {
    return { ok: false, error: "Campanha não encontrada." };
  }
  if (campaign.externalCampaignId) {
    if (campaign.status === "live") {
      return { ok: true };
    }
    if (campaign.status === "error") {
      return {
        ok: false,
        error: `Esta campanha já foi criada no Google (ID ${campaign.externalCampaignId}) mas ficou incompleta. Apague-a no Google Ads e crie um novo rascunho na Clickora; voltar a publicar este rascunho não recupera o estado.`,
      };
    }
  }
  if (!campaign.adGroups.length) {
    return { ok: false, error: "A campanha não tem ad groups." };
  }

  const customerId = conn.googleCustomerId.replace(/\D/g, "");
  publishLog("info", "start", { projectId, campaignId, customerId, adGroups: campaign.adGroups.length });

  for (const ag of campaign.adGroups) {
    const agLabel = (ag.name ?? "").trim() || ag.id;
    if (!ag.adsRsa.length) {
      return { ok: false, error: `O ad group «${agLabel}» precisa de pelo menos um anúncio RSA.` };
    }
    if (!ag.keywords?.length) {
      return {
        ok: false,
        error: `O grupo «${agLabel}» não tem palavras-chave. Campanhas Search precisam de palavras-chave.`,
      };
    }
    for (const rsa of ag.adsRsa) {
      const headlines = parseJsonStringArray(rsa.headlines);
      const descriptions = parseJsonStringArray(rsa.descriptions);
      const finalUrls = parseJsonStringArray(rsa.finalUrls);
      if (headlines.length < 3) {
        return { ok: false, error: `RSA no grupo «${agLabel}»: são necessários pelo menos 3 títulos.` };
      }
      if (descriptions.length < 2) {
        return { ok: false, error: `RSA no grupo «${agLabel}»: são necessárias pelo menos 2 descrições.` };
      }
      const rawUrl = (finalUrls[0] ?? "").trim();
      if (!rawUrl) {
        return { ok: false, error: `RSA no grupo «${agLabel}»: indique uma URL final.` };
      }
      if (!isAbsoluteHttpUrl(ensureUrl(rawUrl))) {
        return { ok: false, error: `RSA no grupo «${agLabel}»: URL final inválida (use http ou https).` };
      }
    }
  }

  let access: string;
  try {
    ({ access_token: access } = await getAccessFromRefreshToken(conn.tokenRef));
  } catch (e) {
    const m = e instanceof Error ? e.message : "Falha ao renovar o token Google.";
    return { ok: false, error: m };
  }

  const dailyMicros = campaign.dailyBudgetMicros ?? 5_000_000n;
  const budgetMicrosStr = String(dailyMicros);
  const geoList = parseJsonStringArray(campaign.geoTargets);
  const langList = parseJsonStringArray(campaign.languageTargets);
  if (!geoList.length) {
    return { ok: false, error: "Defina pelo menos um país (geo) na campanha." };
  }
  if (!langList.length) {
    return { ok: false, error: "Defina pelo menos um idioma." };
  }

  const geoConstants: string[] = [];
  for (const g of geoList) {
    const code = normalizeGoogleCountryCode(String(g));
    if (!code) {
      return {
        ok: false,
        error: `País «${g}» não reconhecido. Use código ISO‑3166‑1 alfa‑2 (ex.: BR, PT, US, DE) ou o nome por extenso (ex.: Brasil, Portugal).`,
      };
    }
    const id = GEO_ID[code];
    if (id == null) {
      return {
        ok: false,
        error: `País «${g}» (código ${code}) sem critério Google nesta integração — alargue geo-google.ts se necessário.`,
      };
    }
    geoConstants.push(`geoTargetConstants/${id}`);
  }

  const languageConstants: string[] = [];
  const resolvedLanguageIso: string[] = [];
  for (const l of langList) {
    const code = normalizeGoogleLanguageCode(String(l));
    if (!code) {
      return {
        ok: false,
        error: `Idioma «${l}» não reconhecido (use ex.: en, pt ou inglês, português).`,
      };
    }
    resolvedLanguageIso.push(code);
    const id = LANG_ID[code];
    if (id == null) {
      return {
        ok: false,
        error: `Idioma «${l}» — código «${code}» ainda não suportado nesta integração.`,
      };
    }
    languageConstants.push(`languageConstants/${id}`);
  }

  const budgetName = `Budget ${campaign.name}`.slice(0, 250);
  const campaignName = campaign.name.slice(0, 250);

  let currentStep = "orçamento";
  try {
    const { resourceNames: budgetResults } = await mutate(
      access,
      dev,
      customerId,
      "campaignBudgets",
      {
        operations: [
          {
            create: {
              name: budgetName,
              amountMicros: budgetMicrosStr,
              deliveryMethod: "STANDARD",
              explicitlyShared: false,
            },
          },
        ],
      },
      loginCustomerId,
    );
    const budgetRn = budgetResults[0];
    if (!budgetRn) {
      return { ok: false, error: "Orçamento: resposta inesperada do Google." };
    }
    publishLog("info", "budget.created", { campaignId, budgetRn });

    currentStep = "campanha (Search)";
    let campaignRn: string | undefined;
    let campaignCreateError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { resourceNames: campResults } = await mutate(
          access,
          dev,
          customerId,
          "campaigns",
          {
            operations: [
              {
                create: {
                  name: campaignNameWithSuffix(campaignName, attempt),
                  status: "ENABLED",
                  advertisingChannelType: "SEARCH",
                  campaignBudget: budgetRn,
                  ...googleCampaignCreateBiddingOneof(campaign.biddingConfig),
                  networkSettings: {
                    targetGoogleSearch: true,
                    targetSearchNetwork: true,
                    targetContentNetwork: false,
                    targetPartnerSearchNetwork: false,
                  },
                  geoTargetTypeSetting: {
                    positiveGeoTargetType: "PRESENCE_OR_INTEREST",
                    /** `PRESENCE_OR_INTEREST` não é válido para negativa na maioria dos tipos (incl. Search). */
                    negativeGeoTargetType: "PRESENCE",
                  },
                  containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
                },
              },
            ],
          },
          loginCustomerId,
        );
        campaignRn = campResults[0];
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (attempt < 2 && isDuplicateCampaignNameError(msg)) continue;
        campaignCreateError = e instanceof Error ? e : new Error(msg);
        break;
      }
    }
    if (campaignCreateError) throw campaignCreateError;
    if (!campaignRn) {
      return { ok: false, error: "Campanha: resposta inesperada do Google." };
    }
    publishLog("info", "campaign.created", { campaignId, campaignRn });

    currentStep = "geo-targets";
    for (const gtc of geoConstants) {
      await mutate(
        access,
        dev,
        customerId,
        "campaignCriteria",
        {
          operations: [
            {
              create: {
                campaign: campaignRn,
                location: { geoTargetConstant: gtc },
              },
            },
          ],
        },
        loginCustomerId,
      );
    }

    currentStep = "idiomas";
    for (const lang of languageConstants) {
      await mutate(
        access,
        dev,
        customerId,
        "campaignCriteria",
        {
          operations: [
            {
              create: {
                campaign: campaignRn,
                language: { languageConstant: lang },
              },
            },
          ],
        },
        loginCustomerId,
      );
    }

    currentStep = "extensões (sitelinks/callouts)";
    const assetExt = readGoogleAssetExtensionsFromBidding(campaign.biddingConfig);
    if (assetExt) {
      await publishGoogleCampaignAssetExtensions({
        mutate,
        accessToken: access,
        devToken: dev,
        customerId,
        loginCustomerId,
        campaignResourceName: campaignRn,
        extensions: assetExt,
      });
      publishLog("info", "assets.linked", {
        campaignId,
        campaignRn,
        sitelinks: assetExt.sitelinks.length,
        callouts: assetExt.callouts.length,
        hasSnippet: Boolean(assetExt.structured_snippet),
      });
    }

    const agResourceByLocalId = new Map<string, string>();
    const keywordsLinkedByAg = new Map<string, number>();
    const rsaLinkedByAg = new Map<string, number>();

    for (let agIndex = 0; agIndex < campaign.adGroups.length; agIndex++) {
      const ag = campaign.adGroups[agIndex]!;
      const baseAgName = (ag.name || "").trim() || `Ad group ${agIndex + 1}`;
      currentStep = `ad group «${baseAgName}»`;
      let agRn: string | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { resourceNames: agR } = await mutate(
            access,
            dev,
            customerId,
            "adGroups",
            {
              operations: [
                {
                  create: {
                    name: adGroupNameWithSuffix(baseAgName, attempt),
                    campaign: campaignRn,
                    status: "ENABLED",
                    type: "SEARCH_STANDARD",
                  },
                },
              ],
            },
            loginCustomerId,
          );
          agRn = agR[0];
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (attempt < 2 && isDuplicateCampaignNameError(msg)) continue;
          throw e;
        }
      }
      if (!agRn) {
        return { ok: false, error: "Ad group: resposta inesperada do Google." };
      }
      agResourceByLocalId.set(ag.id, agRn);
      publishLog("info", "adgroup.created", { campaignId, adGroupId: ag.id, adGroupRn: agRn });

      currentStep = `palavras-chave em «${baseAgName}»`;
      for (const kw of ag.keywords) {
        try {
          const { resourceNames: kwr } = await mutate(
            access,
            dev,
            customerId,
            "adGroupCriteria",
            {
              operations: [
                {
                  create: {
                    adGroup: agRn,
                    status: "ENABLED",
                    keyword: {
                      text: kw.text,
                      matchType: matchTypeToGoogle(kw.matchType),
                    },
                  },
                },
              ],
            },
            loginCustomerId,
          );
          const critRn = kwr[0];
          if (critRn) {
            keywordsLinkedByAg.set(ag.id, (keywordsLinkedByAg.get(ag.id) ?? 0) + 1);
            await prisma.paidAdsKeyword.update({
              where: { id: kw.id },
              data: { externalCriterionId: lastId(critRn), status: "live" as EntityStatus },
            });
          }
        } catch (ke) {
          publishLog("warn", "keyword.failed", {
            campaignId,
            adGroupId: ag.id,
            keywordId: kw.id,
            message: ke instanceof Error ? ke.message : String(ke),
          });
          continue;
        }
      }

      currentStep = `RSA em «${baseAgName}»`;
      for (const rsa of ag.adsRsa) {
        const headlines = parseJsonStringArray(rsa.headlines) as string[];
        const descriptions = parseJsonStringArray(rsa.descriptions) as string[];
        const finalUrls = parseJsonStringArray(rsa.finalUrls);
        const url = ensureUrl((finalUrls[0] ?? "").trim());
        const hParts = headlines.slice(0, 15).map((t) => ({ text: t.slice(0, 30) }));
        const dParts = descriptions.slice(0, 4).map((t) => ({ text: t.slice(0, 90) }));

        try {
          const { resourceNames: adR } = await mutate(
            access,
            dev,
            customerId,
            "adGroupAds",
            {
              operations: [
                {
                  create: {
                    adGroup: agRn,
                    status: "ENABLED",
                    ad: {
                      finalUrls: [url],
                      responsiveSearchAd: { headlines: hParts, descriptions: dParts },
                    },
                  },
                },
              ],
            },
            loginCustomerId,
          );
          const adGroupAdRn = adR[0];
          if (adGroupAdRn) {
            rsaLinkedByAg.set(ag.id, (rsaLinkedByAg.get(ag.id) ?? 0) + 1);
            await prisma.paidAdsRsa.update({
              where: { id: rsa.id },
              data: { externalAdId: lastId(adGroupAdRn), status: "live" as EntityStatus },
            });
          }
        } catch (re) {
          publishLog("warn", "rsa.failed", {
            campaignId,
            adGroupId: ag.id,
            rsaId: rsa.id,
            message: re instanceof Error ? re.message : String(re),
          });
          continue;
        }
      }
    }

    const extCamp = lastId(campaignRn);

    for (const ag of campaign.adGroups) {
      const rsaCount = rsaLinkedByAg.get(ag.id) ?? 0;
      const kwCount = keywordsLinkedByAg.get(ag.id) ?? 0;
      if (rsaCount >= 1 && kwCount >= 1) continue;

      await prisma.paidAdsCampaign.update({
        where: { id: campaign.id },
        data: { externalCampaignId: extCamp, status: "error", languageTargets: resolvedLanguageIso },
      });
      for (const ag2 of campaign.adGroups) {
        const rn = agResourceByLocalId.get(ag2.id);
        if (rn) {
          await prisma.paidAdsAdGroup.update({
            where: { id: ag2.id },
            data: { externalAdGroupId: lastId(rn), status: "live" as EntityStatus },
          });
        }
      }

      const detail =
        rsaCount < 1 && kwCount < 1
          ? "sem anúncios RSA nem palavras-chave criadas na rede"
          : rsaCount < 1
            ? "sem anúncios RSA criados na rede (revise títulos, URL e políticas)"
            : "sem palavras-chave válidas na rede";
      const agLabel = (ag.name ?? "").trim() || ag.id;

      publishLog("error", "publish.partialFailure", {
        campaignId,
        extCamp,
        failedAdGroupId: ag.id,
        rsaLinkedByAg: Object.fromEntries(rsaLinkedByAg),
        keywordsLinkedByAg: Object.fromEntries(keywordsLinkedByAg),
      });

      return {
        ok: false,
        error: humanizeGoogleAdsPublishError(
          `Campanha ${extCamp} criada no Google mas ficou incompleta (${detail}) no grupo «${agLabel}». Abra o Google Ads para rever ou eliminar o rascunho.`,
        ),
      };
    }

    await prisma.paidAdsCampaign.update({
      where: { id: campaign.id },
      data: {
        externalCampaignId: extCamp,
        status: "live",
        languageTargets: resolvedLanguageIso,
      },
    });
    for (const ag of campaign.adGroups) {
      const rn = agResourceByLocalId.get(ag.id);
      if (rn) {
        await prisma.paidAdsAdGroup.update({
          where: { id: ag.id },
          data: { externalAdGroupId: lastId(rn), status: "live" as EntityStatus },
        });
      }
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Falha na publicação Google Ads.";
    publishLog("error", "publish.failed", { projectId, campaignId, step: currentStep, message: raw });
    const stepPrefix = currentStep ? `Falhou no passo «${currentStep}». ` : "";
    return { ok: false, error: `${stepPrefix}${humanizeGoogleAdsPublishError(raw)}` };
  }

  return { ok: true };
}
