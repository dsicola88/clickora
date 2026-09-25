/**
 * Sync diário de custos Google/Meta/TikTok → `ad_platform_cost_daily`.
 * Fonte estável para P&L histórico (não depende só de GAQL live no request).
 */
import { GoogleAdsApi } from "google-ads-api";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "../../lib/prisma";
import { decryptSecretField } from "../../lib/fieldEncryption";
import {
  buildGoogleAdsCredentialsForUser,
  formatGaqlDate,
  isGoogleAdsMetricsReadyForUser,
  type GoogleAdsUserSettings,
} from "../googleAds/googleAds.service";

const DIGITS = /^\d+$/;

function onlyDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

function dayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function rangeDays(lookback: number): { from: Date; to: Date } {
  const to = dayUtc(new Date());
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - Math.max(1, lookback));
  return { from, to };
}

async function upsertCostRow(input: {
  userId: string;
  platform: string;
  date: Date;
  level: string;
  entityKey: string;
  label?: string;
  costMicros: bigint;
  clicks: number;
  impressions: number;
  currency?: string | null;
}) {
  const key = input.entityKey.trim().slice(0, 512).toLowerCase() || "account";
  await systemPrisma.adPlatformCostDaily.upsert({
    where: {
      userId_platform_date_level_entityKey: {
        userId: input.userId,
        platform: input.platform,
        date: input.date,
        level: input.level,
        entityKey: key,
      },
    },
    create: {
      userId: input.userId,
      platform: input.platform,
      date: input.date,
      level: input.level,
      entityKey: key,
      label: input.label?.slice(0, 512),
      costMicros: input.costMicros,
      clicks: input.clicks,
      impressions: input.impressions,
      currency: input.currency ?? "USD",
      syncedAt: new Date(),
    },
    update: {
      label: input.label?.slice(0, 512),
      costMicros: input.costMicros,
      clicks: input.clicks,
      impressions: input.impressions,
      currency: input.currency ?? "USD",
      syncedAt: new Date(),
    },
  });
}

async function syncGoogleForUser(
  user: GoogleAdsUserSettings & { id: string },
  from: Date,
  to: Date,
): Promise<{ ok: true; rows: number } | { ok: false; error: string }> {
  if (!isGoogleAdsMetricsReadyForUser(user)) {
    return { ok: false, error: "google_not_ready" };
  }
  const creds = buildGoogleAdsCredentialsForUser(user);
  const customerId = onlyDigits(user.googleAdsCustomerId);
  if (!creds || !customerId || !DIGITS.test(customerId)) {
    return { ok: false, error: "google_creds" };
  }
  const login = onlyDigits(user.googleAdsLoginCustomerId);
  const client = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: creds.refreshToken,
    ...(login ? { login_customer_id: login } : {}),
  });

  const fromStr = formatGaqlDate(from);
  const toStr = formatGaqlDate(to);
  let rows = 0;

  const accountGaql = `
    SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, customer.currency_code
    FROM customer
    WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'
  `;
  try {
    const accRows = (await customer.query(accountGaql)) as Array<Record<string, unknown>>;
    for (const row of Array.isArray(accRows) ? accRows : []) {
      const seg = row.segments as { date?: string } | undefined;
      const m = row.metrics as { cost_micros?: unknown; clicks?: unknown; impressions?: unknown } | undefined;
      const cust = row.customer as { currency_code?: string } | undefined;
      if (!seg?.date) continue;
      const date = dayUtc(new Date(`${seg.date}T00:00:00.000Z`));
      await upsertCostRow({
        userId: user.id,
        platform: "google_ads",
        date,
        level: "account",
        entityKey: "account",
        label: "Google Ads (conta)",
        costMicros: BigInt(Math.round(Number(m?.cost_micros ?? 0))),
        clicks: Number(m?.clicks ?? 0),
        impressions: Number(m?.impressions ?? 0),
        currency: cust?.currency_code ?? "USD",
      });
      rows += 1;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const kwGaql = `
    SELECT
      segments.date,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.keyword.text,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions
    FROM keyword_view
    WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 20000
  `;
  try {
    const kwRows = (await customer.query(kwGaql)) as Array<Record<string, unknown>>;
    /** Agregar por dia+nível antes de upsert (várias keywords no mesmo ad group). */
    type Agg = { label: string; cost: number; clicks: number; impressions: number; agId?: string };
    const byKw = new Map<string, Agg & { date: Date }>();
    const byAg = new Map<string, Agg & { date: Date }>();
    for (const row of Array.isArray(kwRows) ? kwRows : []) {
      const seg = row.segments as { date?: string } | undefined;
      const m = row.metrics as { cost_micros?: unknown; clicks?: unknown; impressions?: unknown } | undefined;
      const camp = (row.campaign as { name?: string } | undefined)?.name ?? "";
      const agObj = row.ad_group as { name?: string; id?: string | number } | undefined;
      const ag = agObj?.name ?? "";
      const agId = agObj?.id != null ? String(agObj.id) : "";
      const kw =
        (row.ad_group_criterion as { keyword?: { text?: string } } | undefined)?.keyword?.text ?? "";
      if (!seg?.date) continue;
      const date = dayUtc(new Date(`${seg.date}T00:00:00.000Z`));
      const cost = Number(m?.cost_micros ?? 0);
      const clicks = Number(m?.clicks ?? 0);
      const impressions = Number(m?.impressions ?? 0);
      if (kw.trim()) {
        const k = `${seg.date}\t${kw.trim().toLowerCase()}`;
        const cur = byKw.get(k) || { date, label: kw.trim(), cost: 0, clicks: 0, impressions: 0 };
        cur.cost += cost;
        cur.clicks += clicks;
        cur.impressions += impressions;
        byKw.set(k, cur);
      }
      if (ag.trim() || camp.trim() || agId) {
        const k = `${seg.date}\t${agId || `${camp}\t${ag}`}`.toLowerCase();
        const cur =
          byAg.get(k) || {
            date,
            label: ag || camp || agId,
            agId: agId || undefined,
            cost: 0,
            clicks: 0,
            impressions: 0,
          };
        cur.cost += cost;
        cur.clicks += clicks;
        cur.impressions += impressions;
        byAg.set(k, cur);
      }
    }
    for (const [k, v] of byKw) {
      const kw = k.split("\t")[1] || v.label;
      await upsertCostRow({
        userId: user.id,
        platform: "google_ads",
        date: v.date,
        level: "keyword",
        entityKey: kw,
        label: v.label,
        costMicros: BigInt(Math.round(v.cost)),
        clicks: v.clicks,
        impressions: v.impressions,
      });
      rows += 1;
    }
    for (const [, v] of byAg) {
      const key = (v.agId || v.label).toLowerCase();
      await upsertCostRow({
        userId: user.id,
        platform: "google_ads",
        date: v.date,
        level: "ad_group",
        entityKey: key,
        label: v.label,
        costMicros: BigInt(Math.round(v.cost)),
        clicks: v.clicks,
        impressions: v.impressions,
      });
      rows += 1;
    }
  } catch (e) {
    console.warn("[costSync] keyword gaql", e instanceof Error ? e.message : e);
  }

  return { ok: true, rows };
}

async function syncMetaForUser(
  user: { id: string; metaAdsAccountId: string | null; metaAccessToken: string | null },
  from: Date,
  to: Date,
): Promise<{ ok: true; rows: number } | { ok: false; error: string }> {
  const act = (user.metaAdsAccountId || "").replace(/^act_/, "").replace(/\D/g, "");
  const token = decryptSecretField(user.metaAccessToken || "") || user.metaAccessToken;
  if (!act || !token?.trim()) return { ok: false, error: "meta_not_configured" };

  const since = formatGaqlDate(from).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const until = formatGaqlDate(to).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const url = new URL(`https://graph.facebook.com/v21.0/act_${act}/insights`);
  url.searchParams.set("fields", "spend,impressions,clicks,date_start");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("access_token", token.trim());
  url.searchParams.set("level", "account");

  try {
    const res = await fetch(url.toString());
    const json = (await res.json()) as {
      data?: Array<{ spend?: string; impressions?: string; clicks?: string; date_start?: string }>;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      return { ok: false, error: json.error?.message || `meta_http_${res.status}` };
    }
    let rows = 0;
    for (const row of json.data || []) {
      if (!row.date_start) continue;
      const spend = Number(row.spend ?? 0);
      const date = dayUtc(new Date(`${row.date_start}T00:00:00.000Z`));
      await upsertCostRow({
        userId: user.id,
        platform: "meta_ads",
        date,
        level: "account",
        entityKey: "account",
        label: "Meta Ads (conta)",
        costMicros: BigInt(Math.round(spend * 1_000_000)),
        clicks: Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
        currency: "USD",
      });
      rows += 1;
    }
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function syncTikTokForUser(
  user: { id: string; tiktokAdvertiserId: string | null; tiktokEventsAccessToken: string | null },
  from: Date,
  to: Date,
): Promise<{ ok: true; rows: number } | { ok: false; error: string }> {
  const advertiser = (user.tiktokAdvertiserId || "").replace(/\D/g, "");
  const token =
    decryptSecretField(user.tiktokEventsAccessToken || "") || user.tiktokEventsAccessToken;
  if (!advertiser || !token?.trim()) return { ok: false, error: "tiktok_not_configured" };

  /** TikTok Marketing API — relatório diário de gasto (requer token Marketing, não só Events). */
  const start = formatGaqlDate(from).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const end = formatGaqlDate(to).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/", {
      method: "POST",
      headers: {
        "Access-Token": token.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        advertiser_id: advertiser,
        report_type: "BASIC",
        data_level: "AUCTION_ADVERTISER",
        dimensions: ["stat_time_day"],
        metrics: ["spend", "clicks", "impressions"],
        start_date: start,
        end_date: end,
        page_size: 100,
      }),
    });
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: { list?: Array<{ dimensions?: { stat_time_day?: string }; metrics?: { spend?: string; clicks?: string; impressions?: string } }> };
    };
    if (json.code !== 0) {
      return { ok: false, error: json.message || `tiktok_code_${json.code}` };
    }
    let rows = 0;
    for (const row of json.data?.list || []) {
      const day = row.dimensions?.stat_time_day?.slice(0, 10);
      if (!day) continue;
      const spend = Number(row.metrics?.spend ?? 0);
      const date = dayUtc(new Date(`${day}T00:00:00.000Z`));
      await upsertCostRow({
        userId: user.id,
        platform: "tiktok_ads",
        date,
        level: "account",
        entityKey: "account",
        label: "TikTok Ads (conta)",
        costMicros: BigInt(Math.round(spend * 1_000_000)),
        clicks: Number(row.metrics?.clicks ?? 0),
        impressions: Number(row.metrics?.impressions ?? 0),
        currency: "USD",
      });
      rows += 1;
    }
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Soma custo persistido (USD/EUR da plataforma) no intervalo — micros → unidade. */
export async function sumPersistedSpend(input: {
  userId: string;
  from: Date;
  to: Date;
  platforms?: string[];
}): Promise<{ total: number; by_platform: Record<string, number> }> {
  const platforms = input.platforms ?? ["google_ads", "meta_ads", "tiktok_ads"];
  const rows = await systemPrisma.adPlatformCostDaily.findMany({
    where: {
      userId: input.userId,
      level: "account",
      platform: { in: platforms },
      date: { gte: dayUtc(input.from), lte: dayUtc(input.to) },
    },
    select: { platform: true, costMicros: true },
  });
  const by_platform: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const v = Number(r.costMicros) / 1_000_000;
    by_platform[r.platform] = (by_platform[r.platform] || 0) + v;
    total += v;
  }
  for (const k of Object.keys(by_platform)) {
    by_platform[k] = Math.round(by_platform[k] * 100) / 100;
  }
  return { total: Math.round(total * 100) / 100, by_platform };
}

export async function sumPersistedKeywordCosts(input: {
  userId: string;
  from: Date;
  to: Date;
}): Promise<Map<string, number>> {
  const rows = await systemPrisma.adPlatformCostDaily.findMany({
    where: {
      userId: input.userId,
      platform: "google_ads",
      level: "keyword",
      date: { gte: dayUtc(input.from), lte: dayUtc(input.to) },
    },
    select: { entityKey: true, costMicros: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r.entityKey.toLowerCase();
    map.set(k, (map.get(k) || 0) + Number(r.costMicros) / 1_000_000);
  }
  return map;
}

export async function sumPersistedAdGroupCosts(input: {
  userId: string;
  from: Date;
  to: Date;
}): Promise<Map<string, number>> {
  const rows = await systemPrisma.adPlatformCostDaily.findMany({
    where: {
      userId: input.userId,
      platform: "google_ads",
      level: "ad_group",
      date: { gte: dayUtc(input.from), lte: dayUtc(input.to) },
    },
    select: { entityKey: true, label: true, costMicros: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const euros = Number(r.costMicros) / 1_000_000;
    const keys = new Set(
      [r.entityKey, r.label].filter((x): x is string => Boolean(x && String(x).trim())).map((x) => x.toLowerCase()),
    );
    for (const k of keys) {
      map.set(k, (map.get(k) || 0) + euros);
    }
  }
  return map;
}

export async function syncAdCostsForAllUsers(lookbackDays = 7): Promise<{
  users: number;
  google_ok: number;
  meta_ok: number;
  tiktok_ok: number;
}> {
  const { from, to } = rangeDays(lookbackDays);
  const users = await systemPrisma.user.findMany({
    where: {
      OR: [
        { googleAdsRefreshToken: { not: null } },
        { metaAdsAccountId: { not: null } },
        { tiktokAdvertiserId: { not: null } },
      ],
    },
    select: {
      id: true,
      googleAdsEnabled: true,
      googleAdsCustomerId: true,
      googleAdsConversionActionId: true,
      googleAdsLoginCustomerId: true,
      googleAdsRefreshToken: true,
      metaAdsAccountId: true,
      metaAccessToken: true,
      tiktokAdvertiserId: true,
      tiktokEventsAccessToken: true,
    },
  });

  let google_ok = 0;
  let meta_ok = 0;
  let tiktok_ok = 0;
  for (const u of users) {
    const g = await syncGoogleForUser(u, from, to);
    if (g.ok) google_ok += 1;
    const m = await syncMetaForUser(u, from, to);
    if (m.ok) meta_ok += 1;
    const t = await syncTikTokForUser(u, from, to);
    if (t.ok) tiktok_ok += 1;
  }
  return { users: users.length, google_ok, meta_ok, tiktok_ok };
}

export async function syncAdCostsForUser(userId: string, lookbackDays = 14): Promise<void> {
  const { from, to } = rangeDays(lookbackDays);
  const u = await systemPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      googleAdsEnabled: true,
      googleAdsCustomerId: true,
      googleAdsConversionActionId: true,
      googleAdsLoginCustomerId: true,
      googleAdsRefreshToken: true,
      metaAdsAccountId: true,
      metaAccessToken: true,
      tiktokAdvertiserId: true,
      tiktokEventsAccessToken: true,
    },
  });
  if (!u) return;
  await syncGoogleForUser(u, from, to);
  await syncMetaForUser(u, from, to);
  await syncTikTokForUser(u, from, to);
}

/** Evita unused Prisma import warnings in some toolchains. */
void Prisma;
