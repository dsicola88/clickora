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

/** Junta detail `GoogleAdsFailure.errors[].message` ao texto genérico da Google. */
function enrichGoogleMutateError(raw: unknown): string {
  const root = raw as { error?: { message?: string; details?: unknown[] } };
  const base = root.error?.message ?? "Erro na Google Ads API.";
  const details = root.error?.details;
  const extras: string[] = [];
  if (Array.isArray(details)) {
    for (const d of details) {
      if (!d || typeof d !== "object") continue;
      const errs = (d as { errors?: Array<{ message?: string }> }).errors;
      if (!Array.isArray(errs)) continue;
      for (const e of errs) {
        const m = e.message?.trim();
        if (m && !extras.includes(m)) extras.push(m);
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
    return { ok: true };
  }
  if (!campaign.adGroups.length) {
    return { ok: false, error: "A campanha não tem ad groups." };
  }

  const customerId = conn.googleCustomerId.replace(/\D/g, "");

  for (const ag of campaign.adGroups) {
    const rsa = ag.adsRsa[0];
    if (!rsa) {
      return { ok: false, error: `O ad group «${ag.name}» precisa de um anúncio RSA.` };
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

    const { resourceNames: campResults } = await mutate(
      access,
      dev,
      customerId,
      "campaigns",
      {
        operations: [
          {
            create: {
              name: campaignName,
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
    const campaignRn = campResults[0];
    if (!campaignRn) {
      return { ok: false, error: "Campanha: resposta inesperada do Google." };
    }

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
    }

    const agResourceByLocalId = new Map<string, string>();
    for (const ag of campaign.adGroups) {
      const { resourceNames: agR } = await mutate(
        access,
        dev,
        customerId,
        "adGroups",
        {
          operations: [
            {
              create: {
                name: ag.name.slice(0, 255),
                campaign: campaignRn,
                status: "ENABLED",
                type: "SEARCH_STANDARD",
              },
            },
          ],
        },
        loginCustomerId,
      );
      const agRn = agR[0];
      if (!agRn) {
        return { ok: false, error: "Ad group: resposta inesperada do Google." };
      }
      agResourceByLocalId.set(ag.id, agRn);

      for (const kw of ag.keywords) {
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
          await prisma.paidAdsKeyword.update({
            where: { id: kw.id },
            data: { externalCriterionId: lastId(critRn), status: "live" as EntityStatus },
          });
        }
      }

      const rsa = ag.adsRsa[0]!;
      const headlines = parseJsonStringArray(rsa.headlines) as string[];
      const descriptions = parseJsonStringArray(rsa.descriptions) as string[];
      const finalUrls = parseJsonStringArray(rsa.finalUrls);
      const url = ensureUrl(finalUrls[0] ?? "https://example.com");
      if (headlines.length < 3 || descriptions.length < 2) {
        return { ok: false, error: "RSA: são necessários ≥3 títulos e ≥2 descrições." };
      }
      const hParts = headlines.slice(0, 15).map((t) => ({ text: t.slice(0, 30) }));
      const dParts = descriptions.slice(0, 4).map((t) => ({ text: t.slice(0, 90) }));

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
        await prisma.paidAdsRsa.update({
          where: { id: rsa.id },
          data: { externalAdId: lastId(adGroupAdRn), status: "live" as EntityStatus },
        });
      }
    }

    const extCamp = lastId(campaignRn);
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
    return { ok: false, error: humanizeGoogleAdsPublishError(raw) };
  }

  return { ok: true };
}
