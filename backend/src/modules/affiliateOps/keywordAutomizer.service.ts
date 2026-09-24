/**
 * Automizer afiliado: pausa keywords Google com gasto ≥ limiar e receita postback = 0.
 * Usa custo persistido + receita Clickora; mutação via Google Ads API (criterion PAUSED).
 */
import { GoogleAdsApi, enums, resources } from "google-ads-api";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "../../lib/prisma";
import {
  buildGoogleAdsCredentialsForUser,
  isGoogleAdsMetricsReadyForUser,
} from "../googleAds/googleAds.service";
import { sumPersistedKeywordCosts } from "./costSync.service";

function onlyDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

async function revenueByKeyword(userId: string, from: Date, to: Date): Promise<Map<string, number>> {
  const rows = await systemPrisma.$queryRaw<Array<{ keyword: string; revenue: unknown }>>(Prisma.sql`
    SELECT
      LOWER(TRIM(COALESCE(NULLIF(te.metadata->>'utm_term', ''), ''))) AS keyword,
      COALESCE(SUM(c.amount), 0) AS revenue
    FROM tracking_events te
    INNER JOIN conversions c
      ON c.click_id = te.id
     AND c.user_id = te.user_id
     AND c.status = 'approved'
    WHERE te.user_id = ${userId}
      AND te.created_at >= ${from}
      AND te.created_at <= ${to}
      AND te.event_type::text = 'click'
      AND NOT COALESCE((te.metadata->>'is_bot') = 'true', false)
      AND COALESCE(NULLIF(te.metadata->>'utm_term', ''), '') <> ''
    GROUP BY 1
  `);
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.keyword) continue;
    map.set(r.keyword, Number(r.revenue ?? 0));
  }
  return map;
}

async function findCriterionResourceNames(
  customer: { query: (gaql: string) => Promise<unknown> },
  keywordLower: string,
): Promise<string[]> {
  const safe = keywordLower.replace(/'/g, "\\'");
  const gaql = `
    SELECT ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.status
    FROM ad_group_criterion
    WHERE ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.status != 'REMOVED'
      AND ad_group_criterion.keyword.text = '${safe}'
    LIMIT 50
  `;
  try {
    const rows = (await customer.query(gaql)) as Array<Record<string, unknown>>;
    const out: string[] = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const crit = row.ad_group_criterion as { resource_name?: string; status?: unknown } | undefined;
      if (crit?.resource_name) out.push(crit.resource_name);
    }
    return out;
  } catch {
    return [];
  }
}

export async function runKeywordAutomizerForUser(userId: string): Promise<{
  evaluated: number;
  paused: number;
  dry_run: number;
  skipped: number;
}> {
  const user = await systemPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      keywordAutomizerEnabled: true,
      keywordAutomizerDryRun: true,
      keywordAutomizerMinSpendUsd: true,
      keywordAutomizerMinClicks: true,
      keywordAutomizerLookbackDays: true,
      googleAdsEnabled: true,
      googleAdsCustomerId: true,
      googleAdsConversionActionId: true,
      googleAdsLoginCustomerId: true,
      googleAdsRefreshToken: true,
    },
  });
  if (!user?.keywordAutomizerEnabled) {
    return { evaluated: 0, paused: 0, dry_run: 0, skipped: 0 };
  }
  if (!isGoogleAdsMetricsReadyForUser(user)) {
    return { evaluated: 0, paused: 0, dry_run: 0, skipped: 1 };
  }

  const days = Math.min(30, Math.max(1, user.keywordAutomizerLookbackDays || 3));
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  from.setUTCHours(0, 0, 0, 0);

  const minSpend = Number(user.keywordAutomizerMinSpendUsd ?? 15);
  const minClicks = user.keywordAutomizerMinClicks || 20;
  const dryRun = user.keywordAutomizerDryRun !== false;

  const [costMap, revMap] = await Promise.all([
    sumPersistedKeywordCosts({ userId, from, to }),
    revenueByKeyword(userId, from, to),
  ]);

  const clickAgg = await systemPrisma.$queryRaw<Array<{ keyword: string; clicks: bigint }>>(Prisma.sql`
    SELECT
      LOWER(TRIM(COALESCE(NULLIF(metadata->>'utm_term', ''), ''))) AS keyword,
      COUNT(*)::bigint AS clicks
    FROM tracking_events
    WHERE user_id = ${userId}
      AND created_at >= ${from}
      AND created_at <= ${to}
      AND event_type::text = 'click'
      AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
      AND COALESCE(NULLIF(metadata->>'utm_term', ''), '') <> ''
    GROUP BY 1
  `);
  const clickMap = new Map<string, number>();
  for (const r of clickAgg) {
    if (r.keyword) clickMap.set(r.keyword, Number(r.clicks));
  }

  const creds = buildGoogleAdsCredentialsForUser(user);
  const customerId = onlyDigits(user.googleAdsCustomerId);
  if (!creds || !customerId) {
    return { evaluated: 0, paused: 0, dry_run: 0, skipped: 1 };
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

  let evaluated = 0;
  let paused = 0;
  let dry_run = 0;
  let skipped = 0;

  const candidates = new Set([...costMap.keys(), ...clickMap.keys()]);
  for (const kw of candidates) {
    const cost = costMap.get(kw) || 0;
    const revenue = revMap.get(kw) || 0;
    const clicks = clickMap.get(kw) || 0;
    if (cost < minSpend || clicks < minClicks) continue;
    if (revenue > 0) continue;
    evaluated += 1;

    const reason = `Gasto $${cost.toFixed(2)} ≥ $${minSpend} e ${clicks} cliques sem receita postback (${days}d).`;
    const resourcesNames = await findCriterionResourceNames(customer, kw);

    if (dryRun || resourcesNames.length === 0) {
      dry_run += 1;
      await systemPrisma.affiliateAutomizerLog.create({
        data: {
          userId,
          action: resourcesNames.length ? "would_pause_keyword" : "no_criterion_found",
          keyword: kw.slice(0, 512),
          reason,
          dryRun: true,
          ok: true,
          detail: { cost, clicks, revenue, resources: resourcesNames } as Prisma.InputJsonValue,
        },
      });
      continue;
    }

    try {
      const ops = resourcesNames.map((resource_name) => ({
        entity: "ad_group_criterion",
        operation: "update",
        resource: {
          resource_name,
          status: enums.AdGroupCriterionStatus.PAUSED,
        } as resources.IAdGroupCriterion,
        update_mask: { paths: ["status"] },
      }));
      // google-ads-api mutate helper
      await (customer as unknown as { mutateResources: (o: unknown[]) => Promise<unknown> }).mutateResources(ops);
      paused += 1;
      await systemPrisma.affiliateAutomizerLog.create({
        data: {
          userId,
          action: "pause_keyword",
          keyword: kw.slice(0, 512),
          reason,
          dryRun: false,
          ok: true,
          detail: { cost, clicks, revenue, resources: resourcesNames } as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      skipped += 1;
      await systemPrisma.affiliateAutomizerLog.create({
        data: {
          userId,
          action: "pause_keyword_failed",
          keyword: kw.slice(0, 512),
          reason: e instanceof Error ? e.message : String(e),
          dryRun: false,
          ok: false,
          detail: { cost, clicks, revenue } as Prisma.InputJsonValue,
        },
      });
    }
  }

  return { evaluated, paused, dry_run, skipped };
}

export async function runKeywordAutomizerForAllUsers(): Promise<{
  users: number;
  totals: { evaluated: number; paused: number; dry_run: number };
}> {
  const users = await systemPrisma.user.findMany({
    where: { keywordAutomizerEnabled: true },
    select: { id: true },
  });
  const totals = { evaluated: 0, paused: 0, dry_run: 0 };
  for (const u of users) {
    const r = await runKeywordAutomizerForUser(u.id);
    totals.evaluated += r.evaluated;
    totals.paused += r.paused;
    totals.dry_run += r.dry_run;
  }
  return { users: users.length, totals };
}
