/**
 * Mutações de segmentação Google Ads: geo (incluir/excluir), idiomas, dispositivos, idades.
 */
import type { Prisma } from "@prisma/client";
import { GOOGLE_GEO_CRITERION_IDS, normalizeGoogleCountryCode } from "./geo-google";
import {
  GOOGLE_ADS_LANGUAGE_NUMERIC_ID,
  normalizeGoogleLanguageCode,
} from "./language-google";
import { runGoogleAdsMutate, runGoogleAdsSearch } from "./google-ads.api";
import { resolveGoogleAdsAccess } from "./google-ads-connection";
import {
  mergeBiddingConfigTargeting,
  percentToGoogleBidModifier,
  readGoogleCampaignTargeting,
  type GoogleAgeRangeKey,
  type GoogleDeviceBidKey,
} from "./google-ads-targeting-store";
import { prisma } from "./paidPrisma";

export type CrResult = { ok: true } | { ok: false; error: string };

async function ctxForProject(
  projectId: string,
): Promise<
  | { err: string }
  | { access: string; customerId: string; dev: string; login: string | undefined }
> {
  const ctx = await resolveGoogleAdsAccess(projectId);
  if (!ctx.ok) return { err: ctx.error };
  if (!ctx.dev || !ctx.access || !ctx.customerId) {
    return { err: "Ligação Google Ads incompleta (token / customer / developer)." };
  }
  return {
    access: ctx.access,
    customerId: ctx.customerId,
    dev: ctx.dev,
    login: ctx.loginCustomerId,
  };
}

function criterionResourceName(row: unknown, camel: string, snake: string): string {
  if (!row || typeof row !== "object") return "";
  const o = row as Record<string, unknown>;
  const a = o[camel];
  const b = o[snake];
  const pick = (v: unknown) => {
    if (!v || typeof v !== "object") return "";
    const r = v as Record<string, unknown>;
    return String(r.resourceName ?? r.resource_name ?? "");
  };
  return pick(a) || pick(b);
}

function parseJsonStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function toGeoConstant(iso: string): string | null {
  const code = normalizeGoogleCountryCode(iso);
  if (!code) return null;
  const id = GOOGLE_GEO_CRITERION_IDS[code];
  if (!id) return null;
  return `geoTargetConstants/${id}`;
}

function uniqueIsos(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const c = normalizeGoogleCountryCode(raw);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** Substitui critérios de localização da campanha (positivos + negativos). */
export async function applyGoogleSyncCampaignGeoTargets(
  projectId: string,
  p: { campaign_id: string; include: string[]; exclude: string[] },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev, login } = c0;
  const cid = `customers/${customerId}`;

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: p.campaign_id, projectId, platform: "google_ads" },
  });
  if (!camp?.externalCampaignId) {
    return { ok: false, error: "Campanha não publicada na Google." };
  }
  const extCamp = camp.externalCampaignId.replace(/\D/g, "");
  const campaignRn = `${cid}/campaigns/${extCamp}`;

  const include = uniqueIsos(p.include);
  const exclude = uniqueIsos(p.exclude).filter((x) => !include.includes(x));
  if (include.length === 0) {
    return { ok: false, error: "Seleccione pelo menos um país para anunciar." };
  }

  const search = await runGoogleAdsSearch(
    access,
    customerId,
    dev,
    `
    SELECT campaign_criterion.resource_name
    FROM campaign_criterion
    WHERE campaign.id = ${extCamp}
      AND campaign_criterion.type = 'LOCATION'
    `,
    login,
  );
  if (search.error) {
    return { ok: false, error: search.error.message ?? "Falha ao ler localizações na Google." };
  }
  for (const row of search.results ?? []) {
    const rn = criterionResourceName(row, "campaignCriterion", "campaign_criterion");
    if (!rn) continue;
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "campaignCriteria",
      { operations: [{ remove: rn }] },
      login,
    );
    if (m.error?.message) return { ok: false, error: m.error.message };
  }

  for (const iso of include) {
    const gtc = toGeoConstant(iso);
    if (!gtc) continue;
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
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
      login,
    );
    if (m.error?.message) return { ok: false, error: m.error.message };
  }

  for (const iso of exclude) {
    const gtc = toGeoConstant(iso);
    if (!gtc) continue;
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "campaignCriteria",
      {
        operations: [
          {
            create: {
              campaign: campaignRn,
              negative: true,
              location: { geoTargetConstant: gtc },
            },
          },
        ],
      },
      login,
    );
    if (m.error?.message) return { ok: false, error: m.error.message };
  }

  const merged = mergeBiddingConfigTargeting(camp.biddingConfig, { geo_exclude: exclude });
  await prisma.paidAdsCampaign.update({
    where: { id: camp.id },
    data: {
      geoTargets: include,
      biddingConfig: merged as Prisma.InputJsonValue,
    },
  });

  return { ok: true };
}

function uniqueLangIsos(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const c = normalizeGoogleLanguageCode(String(raw));
    if (!c || seen.has(c)) continue;
    if (!(c in GOOGLE_ADS_LANGUAGE_NUMERIC_ID)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** Substitui critérios de idioma da campanha. */
export async function applyGoogleSyncCampaignLanguageTargets(
  projectId: string,
  p: { campaign_id: string; languages: string[] },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev, login } = c0;
  const cid = `customers/${customerId}`;

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: p.campaign_id, projectId, platform: "google_ads" },
  });
  if (!camp?.externalCampaignId) {
    return { ok: false, error: "Campanha não publicada na Google." };
  }
  const extCamp = camp.externalCampaignId.replace(/\D/g, "");
  const campaignRn = `${cid}/campaigns/${extCamp}`;

  const languages = uniqueLangIsos(p.languages);
  if (languages.length === 0) {
    return { ok: false, error: "Seleccione pelo menos um idioma." };
  }

  const search = await runGoogleAdsSearch(
    access,
    customerId,
    dev,
    `
    SELECT campaign_criterion.resource_name
    FROM campaign_criterion
    WHERE campaign.id = ${extCamp}
      AND campaign_criterion.type = 'LANGUAGE'
    `,
    login,
  );
  if (search.error) {
    return { ok: false, error: search.error.message ?? "Falha ao ler idiomas na Google." };
  }
  for (const row of search.results ?? []) {
    const rn = criterionResourceName(row, "campaignCriterion", "campaign_criterion");
    if (!rn) continue;
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "campaignCriteria",
      { operations: [{ remove: rn }] },
      login,
    );
    if (m.error?.message) return { ok: false, error: m.error.message };
  }

  for (const iso of languages) {
    const id = GOOGLE_ADS_LANGUAGE_NUMERIC_ID[iso];
    if (!id) continue;
    const m = await runGoogleAdsMutate(
      access,
      customerId,
      dev,
      "campaignCriteria",
      {
        operations: [
          {
            create: {
              campaign: campaignRn,
              language: { languageConstant: `languageConstants/${id}` },
            },
          },
        ],
      },
      login,
    );
    if (m.error?.message) return { ok: false, error: m.error.message };
  }

  await prisma.paidAdsCampaign.update({
    where: { id: camp.id },
    data: { languageTargets: languages },
  });

  return { ok: true };
}

/** Ajustes de lance / exclusão por dispositivo (−100% = excluir). */
export async function applyGoogleSyncCampaignDeviceBids(
  projectId: string,
  p: { campaign_id: string; device_bids: Partial<Record<GoogleDeviceBidKey, number>> },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev, login } = c0;
  const cid = `customers/${customerId}`;

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: p.campaign_id, projectId, platform: "google_ads" },
  });
  if (!camp?.externalCampaignId) {
    return { ok: false, error: "Campanha não publicada na Google." };
  }
  const extCamp = camp.externalCampaignId.replace(/\D/g, "");
  const campaignRn = `${cid}/campaigns/${extCamp}`;

  const search = await runGoogleAdsSearch(
    access,
    customerId,
    dev,
    `
    SELECT
      campaign_bid_modifier.resource_name,
      campaign_bid_modifier.device.type
    FROM campaign_bid_modifier
    WHERE campaign.id = ${extCamp}
    `,
    login,
  );
  if (search.error) {
    return { ok: false, error: search.error.message ?? "Falha ao ler dispositivos na Google." };
  }

  const byDevice = new Map<string, string>();
  for (const row of search.results ?? []) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const mod = (o.campaignBidModifier ?? o.campaign_bid_modifier) as
      | { resourceName?: string; resource_name?: string; device?: { type?: string } }
      | undefined;
    const type = String(mod?.device?.type ?? "");
    const rn = String(mod?.resourceName ?? mod?.resource_name ?? "");
    if (type && rn) byDevice.set(type, rn);
  }

  const keys: GoogleDeviceBidKey[] = ["MOBILE", "DESKTOP", "TABLET"];
  for (const key of keys) {
    const pct = p.device_bids[key];
    if (pct == null || !Number.isFinite(pct)) continue;
    const bidModifier = percentToGoogleBidModifier(pct);
    const existing = byDevice.get(key);
    if (existing) {
      const m = await runGoogleAdsMutate(
        access,
        customerId,
        dev,
        "campaignBidModifiers",
        {
          operations: [
            {
              update: {
                resourceName: existing,
                bidModifier,
              },
              updateMask: "bidModifier",
            },
          ],
        },
        login,
      );
      if (m.error?.message) return { ok: false, error: m.error.message };
    } else {
      const m = await runGoogleAdsMutate(
        access,
        customerId,
        dev,
        "campaignBidModifiers",
        {
          operations: [
            {
              create: {
                campaign: campaignRn,
                device: { type: key },
                bidModifier,
              },
            },
          ],
        },
        login,
      );
      if (m.error?.message) return { ok: false, error: m.error.message };
    }
  }

  const merged = mergeBiddingConfigTargeting(camp.biddingConfig, { device_bids: p.device_bids });
  await prisma.paidAdsCampaign.update({
    where: { id: camp.id },
    data: { biddingConfig: merged as Prisma.InputJsonValue },
  });
  return { ok: true };
}

const AGE_KEYS = new Set<string>([
  "AGE_RANGE_18_24",
  "AGE_RANGE_25_34",
  "AGE_RANGE_35_44",
  "AGE_RANGE_45_54",
  "AGE_RANGE_55_64",
  "AGE_RANGE_65_UP",
  "AGE_RANGE_UNDETERMINED",
]);

/** Exclusões de idade (negativas) em todos os grupos da campanha. */
export async function applyGoogleSyncCampaignAgeExclusions(
  projectId: string,
  p: { campaign_id: string; age_exclude: string[] },
): Promise<CrResult> {
  const c0 = await ctxForProject(projectId);
  if ("err" in c0) return { ok: false, error: c0.err };
  const { access, customerId, dev, login } = c0;
  const cid = `customers/${customerId}`;

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: p.campaign_id, projectId, platform: "google_ads" },
    include: { adGroups: { where: { status: { not: "archived" } }, select: { id: true, externalAdGroupId: true } } },
  });
  if (!camp?.externalCampaignId) {
    return { ok: false, error: "Campanha não publicada na Google." };
  }

  const desired = [
    ...new Set(
      p.age_exclude.map((x) => String(x).trim()).filter((x) => AGE_KEYS.has(x)),
    ),
  ] as GoogleAgeRangeKey[];

  for (const ag of camp.adGroups) {
    if (!ag.externalAdGroupId) continue;
    const agNum = ag.externalAdGroupId.replace(/\D/g, "");
    const agRn = `${cid}/adGroups/${agNum}`;

    const search = await runGoogleAdsSearch(
      access,
      customerId,
      dev,
      `
      SELECT ad_group_criterion.resource_name
      FROM ad_group_criterion
      WHERE ad_group.id = ${agNum}
        AND ad_group_criterion.type = 'AGE_RANGE'
        AND ad_group_criterion.negative = TRUE
      `,
      login,
    );
    if (search.error) {
      return { ok: false, error: search.error.message ?? "Falha ao ler idades na Google." };
    }
    for (const row of search.results ?? []) {
      const rn = criterionResourceName(row, "adGroupCriterion", "ad_group_criterion");
      if (!rn) continue;
      const m = await runGoogleAdsMutate(
        access,
        customerId,
        dev,
        "adGroupCriteria",
        { operations: [{ remove: rn }] },
        login,
      );
      if (m.error?.message) return { ok: false, error: m.error.message };
    }

    for (const age of desired) {
      const m = await runGoogleAdsMutate(
        access,
        customerId,
        dev,
        "adGroupCriteria",
        {
          operations: [
            {
              create: {
                adGroup: agRn,
                negative: true,
                ageRange: { type: age },
              },
            },
          ],
        },
        login,
      );
      if (m.error?.message) return { ok: false, error: m.error.message };
    }
  }

  const merged = mergeBiddingConfigTargeting(camp.biddingConfig, { age_exclude: desired });
  await prisma.paidAdsCampaign.update({
    where: { id: camp.id },
    data: { biddingConfig: merged as Prisma.InputJsonValue },
  });
  return { ok: true };
}

export function targetingFromCampaignRow(camp: {
  geoTargets: unknown;
  biddingConfig: unknown;
}): {
  geo_include: string[];
  geo_exclude: string[];
  device_bids: Partial<Record<GoogleDeviceBidKey, number>>;
  age_exclude: GoogleAgeRangeKey[];
} {
  const t = readGoogleCampaignTargeting(camp.biddingConfig);
  return {
    geo_include: uniqueIsos(parseJsonStringArray(camp.geoTargets)),
    geo_exclude: uniqueIsos(t.geo_exclude ?? []),
    device_bids: {
      MOBILE: t.device_bids?.MOBILE ?? 0,
      DESKTOP: t.device_bids?.DESKTOP ?? 0,
      TABLET: t.device_bids?.TABLET ?? 0,
    },
    age_exclude: t.age_exclude ?? [],
  };
}
