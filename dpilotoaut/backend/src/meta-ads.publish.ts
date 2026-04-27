/**
 * Publica campanha Meta (Facebook/Instagram) a partir do modelo local, via Graph API.
 * - Estados ACTIVE no Meta; orçamento pode consumir.
 * - Targeting UE/EEA: dsa_beneficiary + dsa_payor (payload ou META_DSA_BENEFICIARY / META_DSA_PAYOR).
 * - Página: META_PROMOTED_PAGE_ID, META_PAGE_ID ou `page_id` no payload.
 */
import type { EntityStatus, MetaCta } from "@prisma/client";

import { prisma } from "./prisma";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Dados adicionais do `paid_change_requests.payload` (além de `campaign_id`, etc.) */
export type MetaApiPayload = Record<string, unknown> | null;

export type MetaPublishResult = { ok: true } | { ok: false; error: string };

function normActId(adAccountId: string): string {
  const s = adAccountId.replace(/^act_/, "");
  return `act_${s}`;
}

function toCampaignObjective(obj: string | undefined): string {
  const o = (obj ?? "traffic").toLowerCase();
  if (o === "traffic" || o === "link") return "OUTCOME_TRAFFIC";
  if (o === "leads") return "OUTCOME_LEADS";
  if (o === "purchases" || o === "sales") return "OUTCOME_SALES";
  if (o === "awareness") return "OUTCOME_AWARENESS";
  if (o === "engagement") return "OUTCOME_ENGAGEMENT";
  if (o === "app_promotion") return "OUTCOME_APP_PROMOTION";
  return "OUTCOME_TRAFFIC";
}

const SPECIAL: Record<string, string> = {
  credit: "CREDIT",
  employment: "EMPLOYMENT",
  housing: "HOUSING",
  issues_elections_politics: "ISSUES_ELECTORATIONS_POLITICS",
  online_gambling_and_gaming: "ONLINE_GAMBLING_AND_GAMING",
};

function toSpecialAdCategories(fromPayload: string[] | undefined): {
  categories: string[];
  error: string | null;
} {
  const raw = (fromPayload ?? []).filter((c) => c && c !== "none");
  if (raw.length === 0) return { categories: [], error: null };
  const out: string[] = [];
  for (const c of raw) {
    const k = SPECIAL[c];
    if (!k) {
      return { categories: [], error: `Categoria especial desconhecida: ${c}` };
    }
    out.push(k);
  }
  return { categories: out, error: null };
}

const CTA_MAP: Record<MetaCta, string> = {
  learn_more: "LEARN_MORE",
  shop_now: "SHOP_NOW",
  sign_up: "SIGN_UP",
  contact_us: "CONTACT_US",
  book_now: "BOOK_NOW",
  download: "DOWNLOAD",
  get_quote: "GET_QUOTE",
  subscribe: "SUBSCRIBE",
};

type TargetingJson = {
  geo?: string[];
  age_min?: number;
  age_max?: number;
  gender?: string;
};

/** UE, EEA e territórios frequentemente abrangidos pelo DSA em anúncios Meta. */
const DSA_REGULATED_COUNTRY = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "CH",
  "GB",
  "UK",
  "AD",
  "MC",
  "SM",
  "VA",
  "GP",
  "GF",
  "MQ",
  "RE",
  "YT",
  "PM",
  "BL",
  "MF",
]);

function resolveTargetCountries(t: TargetingJson, countriesFallback: string[]): string[] {
  const raw = (t.geo?.length ? t.geo : countriesFallback)
    .map((c) =>
      c
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2),
    )
    .filter((c) => c.length === 2);
  return raw.length ? raw : ["US"];
}

function targetingRequiresDsa(countries: string[]): boolean {
  return countries.some((c) => DSA_REGULATED_COUNTRY.has(c));
}

function buildTargeting(
  t: TargetingJson,
  placements: string[] | undefined,
  countries: string[],
): string {
  const geo = countries.length ? countries : ["US"];
  const targeting: Record<string, unknown> = {
    geo_locations: { countries: geo },
    age_min: Math.max(13, t.age_min ?? 18),
    age_max: Math.min(65, t.age_max ?? 65),
  };
  if (t.gender === "male") targeting.genders = [1];
  else if (t.gender === "female") targeting.genders = [2];
  else targeting.genders = [1, 2];

  const p = placements?.length ? placements : (["facebook_feed", "instagram_feed"] as const);
  const pub = new Set<string>();
  const fb: Set<string> = new Set();
  const ig: Set<string> = new Set();
  for (const pl of p) {
    if (pl === "facebook_feed" || pl === "facebook_reels") {
      pub.add("facebook");
      if (pl === "facebook_feed") fb.add("feed");
      if (pl === "facebook_reels") fb.add("video_feeds");
    }
    if (pl.startsWith("instagram_")) {
      pub.add("instagram");
      if (pl === "instagram_feed") ig.add("stream");
      if (pl === "instagram_stories") ig.add("story");
      if (pl === "instagram_reels") ig.add("reels");
    }
    if (pl === "messenger") pub.add("messenger");
    if (pl === "audience_network") pub.add("audience_network");
  }
  if (pub.size) {
    targeting.publisher_platforms = Array.from(pub);
    if (fb.size) targeting.facebook_positions = Array.from(fb);
    if (ig.size) targeting.instagram_positions = Array.from(ig);
  }
  return JSON.stringify(targeting);
}

function defaultOptimization(og: string | null | undefined): { og: string; be: string } {
  const s = (og ?? "LINK_CLICKS").toUpperCase();
  if (s.includes("IMPRESSION") || s === "REACH" || s === "BRAND_AWARENESS") {
    return {
      og: s === "REACH" || s === "BRAND_AWARENESS" ? "REACH" : "IMPRESSIONS",
      be: "IMPRESSIONS",
    };
  }
  if (s.includes("LEAD")) return { og: "LEAD_GENERATION", be: "IMPRESSIONS" };
  if (s.includes("CONVERSION") || s.includes("PURCHASE")) {
    return { og: "OFFSITE_CONVERSIONS", be: "IMPRESSIONS" };
  }
  return { og: "LINK_CLICKS", be: "IMPRESSIONS" };
}

async function graphFormPost(
  path: string,
  accessToken: string,
  body: Record<string, string>,
): Promise<{ id: string }> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", accessToken);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const j = (await res.json()) as {
    id?: string;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok || j.error) {
    const m = j.error?.error_user_msg ?? j.error?.message ?? `Graph API ${res.status}`;
    throw new Error(m);
  }
  if (!j.id) {
    throw new Error("Resposta Graph sem id.");
  }
  return { id: j.id };
}

/**
 * Cria campanha + ad set + criativos + anúncios no Meta, grava `external_*`.
 */
export async function publishMetaCreateCampaignFromLocal(
  projectId: string,
  campaignId: string,
  crPayload: MetaApiPayload = null,
): Promise<MetaPublishResult> {
  const pageId =
    (crPayload as { page_id?: string } | undefined)?.page_id?.trim() ||
    process.env.META_PROMOTED_PAGE_ID?.trim() ||
    process.env.META_PAGE_ID?.trim();
  if (!pageId) {
    return {
      ok: false,
      error:
        "Defina META_PROMOTED_PAGE_ID (ou META_PAGE_ID) no servidor, ou inclua `page_id` no payload. Anúncios de ligação precisam de uma Página Facebook.",
    };
  }

  const conn = await prisma.metaConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.adAccountId) {
    return { ok: false, error: "Ligue a conta Meta (OAuth) e selecione um Ad Account." };
  }
  if (conn.tokenRef.startsWith("state:")) {
    return { ok: false, error: "Sessão Meta inválida; volte a conectar." };
  }

  const { categories: specCats, error: specErr } = toSpecialAdCategories(
    (crPayload?.special_ad_categories as string[] | undefined) ?? undefined,
  );
  if (specErr) return { ok: false, error: specErr };

  const token = conn.tokenRef;
  const act = normActId(conn.adAccountId);
  const actPath = `${act}/`;

  const camp = await prisma.paidCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "meta_ads" },
    include: {
      metaAdsets: {
        orderBy: { createdAt: "asc" },
        include: {
          creatives: { orderBy: { createdAt: "asc" } },
          metaAds: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!camp) {
    return { ok: false, error: "Campanha Meta não encontrada." };
  }
  if (camp.externalCampaignId) {
    return { ok: true };
  }
  const adset = camp.metaAdsets[0];
  if (!adset) {
    return { ok: false, error: "Sem conjunto de anúncios (ad set) na campanha." };
  }
  if (!adset.creatives.length) {
    return { ok: false, error: "Sem criativos para publicar." };
  }

  const fromPayload = crPayload?.landing_url;
  const landing =
    (typeof fromPayload === "string" && fromPayload.trim() ? fromPayload.trim() : "") ||
    (adset.creatives[0]!.destinationUrl ?? "") ||
    "";
  if (!landing) {
    return { ok: false, error: "URL de destino em falta." };
  }

  const geoList = (Array.isArray(camp.geoTargets) ? (camp.geoTargets as string[]) : []) as string[];
  const placementList = Array.isArray(crPayload?.placements)
    ? (crPayload!.placements as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;
  const tj = (adset.targeting ?? {}) as TargetingJson;
  const targetCountries = resolveTargetCountries(tj, geoList);
  const needDsa = targetingRequiresDsa(targetCountries);
  let dsaBeneficiary: string | undefined;
  let dsaPayor: string | undefined;
  if (needDsa) {
    const fromB =
      typeof crPayload?.dsa_beneficiary === "string" ? crPayload.dsa_beneficiary.trim() : "";
    const fromP = typeof crPayload?.dsa_payor === "string" ? crPayload.dsa_payor.trim() : "";
    dsaBeneficiary = (fromB || process.env.META_DSA_BENEFICIARY?.trim() || "").slice(0, 512);
    dsaPayor = (fromP || process.env.META_DSA_PAYOR?.trim() || "").slice(0, 512);
    if (!dsaBeneficiary || !dsaPayor) {
      return {
        ok: false,
        error:
          "Targeting inclui UE/EEA: é obrigatório indicar beneficiário e pagador do anúncio (DSA). Defina META_DSA_BENEFICIARY e META_DSA_PAYOR no servidor ou dsa_beneficiary / dsa_payor no payload do pedido.",
      };
    }
  }
  const targeting = buildTargeting(tj, placementList, targetCountries);
  const { og: optGoal, be: billEv } = defaultOptimization(adset.optimizationGoal);
  const dailyBudgetCents = Number(
    adset.dailyBudgetCents ??
      (camp.dailyBudgetMicros != null ? BigInt(camp.dailyBudgetMicros) / 100n : 500n),
  );
  const dailyBudget = Math.max(100, Math.round(dailyBudgetCents));

  const campaignObj = toCampaignObjective(
    typeof crPayload?.objective === "string" ? crPayload.objective : undefined,
  );
  const specialJson = JSON.stringify(specCats);
  const campaignName = camp.name.slice(0, 256);

  try {
    const cRes = await graphFormPost(`${actPath}campaigns`, token, {
      name: campaignName,
      objective: campaignObj,
      status: "ACTIVE",
      special_ad_categories: specialJson,
    });
    const metaCampaignId = cRes.id;

    const adsetBase: Record<string, string> = {
      name: adset.name.slice(0, 256),
      campaign_id: metaCampaignId,
      daily_budget: String(dailyBudget),
      billing_event: billEv,
      optimization_goal: optGoal,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting,
      status: "ACTIVE",
    };
    if (needDsa && dsaBeneficiary && dsaPayor) {
      adsetBase.dsa_beneficiary = dsaBeneficiary;
      adsetBase.dsa_payor = dsaPayor;
    }
    const aRes = await graphFormPost(`${actPath}adsets`, token, adsetBase);
    const metaAdsetId = aRes.id;

    for (const mcr of adset.creatives) {
      const msg = (mcr.primaryText ?? "").slice(0, 2000);
      const title = (mcr.headline ?? "").slice(0, 255);
      const desc = (mcr.description ?? "")?.slice(0, 200) ?? "";
      const cta = CTA_MAP[mcr.cta] ?? "LEARN_MORE";
      const story = JSON.stringify({
        page_id: pageId,
        link_data: {
          message: msg,
          name: title,
          description: desc,
          link: landing,
          call_to_action: { type: cta },
        },
      });

      const crRes = await graphFormPost(`${actPath}adcreatives`, token, {
        name: `Creative — ${title}`.slice(0, 256),
        object_story_spec: story,
      });
      const creativeId = crRes.id;

      await prisma.metaCreative.update({
        where: { id: mcr.id },
        data: { externalId: creativeId, status: "live" as EntityStatus },
      });

      const localAd = adset.metaAds.find((a) => a.creativeId === mcr.id);
      const adName = (localAd?.name ?? title).slice(0, 256);
      const adRes = await graphFormPost(`${actPath}ads`, token, {
        name: adName,
        adset_id: metaAdsetId,
        status: "ACTIVE",
        creative: JSON.stringify({ creative_id: creativeId }),
      });
      const adId = adRes.id;
      if (localAd) {
        await prisma.metaAd.update({
          where: { id: localAd.id },
          data: { externalAdId: adId, status: "live" as EntityStatus },
        });
      }
    }

    await prisma.paidCampaign.update({
      where: { id: camp.id },
      data: { externalCampaignId: metaCampaignId, status: "live" },
    });
    await prisma.metaAdset.update({
      where: { id: adset.id },
      data: { externalId: metaAdsetId, status: "live" as EntityStatus },
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : "Falha na publicação Meta.";
    return { ok: false, error: m };
  }

  return { ok: true };
}
