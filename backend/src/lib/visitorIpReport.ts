/**
 * Relatório de visitas por IP (fugas / bots / IPs suspeitos).
 * Só agrega TrackingEvent já gravados — não altera o pipeline de tracking.
 * Nomenclatura própria dclickora: "suspeito" (não imita produtos de terceiros).
 */
import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { resolveClickVisitorEvidence } from "./clickVisitorEvidence";
import { resolveTrafficType, type TrafficTypeLabel } from "./networkClickId";

export type VisitorIpTrafficFilter = "all" | "paid" | "organic";

/** Mercados com muita concorrência de afiliados a “espiar” anúncios (sinal, não bloqueio). */
const HIGH_AFFILIATE_COMPETITION_ISO2 = new Set(["BR", "IN", "ID", "PH", "NG", "PK", "BD"]);

export type VisitorIpRow = {
  ip: string;
  last_seen: string;
  visits: number;
  clicks: number;
  country: string | null;
  traffic_type: TrafficTypeLabel;
  is_bot: boolean;
  bot_label: string | null;
  is_cloud: boolean;
  cloud_label: string | null;
  /** Heurística dclickora — sugestão de bloqueio manual, nunca automática. */
  is_suspect: boolean;
  suspect_reasons: string[];
  has_sale: boolean;
  blacklisted: boolean;
  fuga_pct: number | null;
};

export type VisitorIpReport = {
  period: { from: string; to: string };
  traffic_filter: VisitorIpTrafficFilter;
  summary: {
    visits: number;
    clicks: number;
    fuga_pct: number | null;
    bots: number;
    suspects: number;
    cloud: number;
    with_sale: number;
  };
  rows: VisitorIpRow[];
};

type AggRow = {
  ip: string;
  last_seen: Date;
  visits: bigint | number;
  clicks: bigint | number;
  country: string | null;
  user_agent: string | null;
  source: string | null;
  medium: string | null;
  metadata: unknown;
};

function metaString(meta: Record<string, unknown> | null, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function parseMeta(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function normalizeCountry(code: string | null | undefined): string | null {
  const c = (code || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/**
 * Regras explícitas — Googlebot nunca é suspeito.
 * Cada motivo fica em `suspect_reasons` para a UI explicar o sinal.
 */
export function classifyVisitorIpFlags(input: {
  visits: number;
  clicks: number;
  has_sale: boolean;
  is_bot: boolean;
  bot_label: string | null;
  is_cloud: boolean;
  traffic_type: TrafficTypeLabel;
  country?: string | null;
}): { is_suspect: boolean; suspect_reasons: string[]; fuga_pct: number | null } {
  const visits = Math.max(0, Math.floor(input.visits));
  const clicks = Math.max(0, Math.floor(input.clicks));
  const fuga_pct = visits > 0 ? Math.round(((visits - Math.min(clicks, visits)) / visits) * 10000) / 100 : null;

  const botLabel = (input.bot_label || "").toLowerCase();
  const isGoogleBot =
    input.is_bot &&
    (/google/i.test(botLabel) || /adsbot|inspectiontool|googlebot|mediapartners/i.test(botLabel));

  if (input.has_sale || isGoogleBot) {
    return { is_suspect: false, suspect_reasons: [], fuga_pct };
  }

  const reasons: string[] = [];
  const paid = input.traffic_type === "paid";
  const untracked = input.traffic_type === "paid_untracked";
  const paidish = paid || untracked;
  const country = normalizeCountry(input.country);

  if (paidish && !input.is_bot && visits >= 3) {
    reasons.push("paid_repeat_visits");
  }
  if (paidish && !input.is_bot && clicks >= 2) {
    reasons.push("paid_repeat_clicks");
  }
  if (untracked && !input.is_bot && visits >= 2) {
    reasons.push("paid_missing_click_id");
  }
  if (input.is_cloud && paidish && (clicks >= 1 || visits >= 2)) {
    reasons.push("cloud_on_paid");
  }
  if (!input.is_bot && visits >= 6 && clicks >= 3) {
    reasons.push("high_volume_no_sale");
  }
  if (
    country &&
    HIGH_AFFILIATE_COMPETITION_ISO2.has(country) &&
    !input.is_bot &&
    visits >= 2 &&
    (paidish || visits >= 3)
  ) {
    reasons.push("competition_geo");
  }

  return { is_suspect: reasons.length > 0, suspect_reasons: reasons, fuga_pct };
}

function trafficMatches(filter: VisitorIpTrafficFilter, type: TrafficTypeLabel): boolean {
  if (filter === "all") return true;
  if (filter === "paid") return type === "paid" || type === "paid_untracked";
  return type === "organic";
}

const IP_NORM_SQL = Prisma.sql`
  CASE
    WHEN LOWER(TRIM(ip_address)) LIKE '::ffff:%'
      THEN SUBSTRING(LOWER(TRIM(ip_address)) FROM 8)
    ELSE LOWER(TRIM(ip_address))
  END
`;

export async function loadVisitorIpReport(args: {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  /** Datas canónicas YYYY-MM-DD do pedido (evita desvio UTC no período). */
  periodFrom?: string;
  periodTo?: string;
  traffic?: VisitorIpTrafficFilter;
  limit?: number;
}): Promise<VisitorIpReport> {
  const traffic = args.traffic ?? "all";
  const limit = Math.min(Math.max(args.limit ?? 150, 1), 300);

  const agg = await systemPrisma.$queryRaw<AggRow[]>(Prisma.sql`
    SELECT
      ${IP_NORM_SQL} AS ip,
      MAX(created_at) AS last_seen,
      COUNT(*) FILTER (WHERE event_type = 'impression'::"EventType")::bigint AS visits,
      COUNT(*) FILTER (WHERE event_type = 'click'::"EventType")::bigint AS clicks,
      MAX(NULLIF(TRIM(country), '')) AS country,
      (ARRAY_AGG(user_agent ORDER BY created_at DESC)
        FILTER (WHERE user_agent IS NOT NULL AND TRIM(user_agent) <> ''))[1] AS user_agent,
      (ARRAY_AGG(source ORDER BY created_at DESC)
        FILTER (WHERE source IS NOT NULL AND TRIM(source) <> ''))[1] AS source,
      (ARRAY_AGG(medium ORDER BY created_at DESC)
        FILTER (WHERE medium IS NOT NULL AND TRIM(medium) <> ''))[1] AS medium,
      (ARRAY_AGG(metadata ORDER BY created_at DESC))[1] AS metadata
    FROM tracking_events
    WHERE user_id = ${args.userId}
      AND created_at >= ${args.rangeStart}
      AND created_at <= ${args.rangeEnd}
      AND ip_address IS NOT NULL
      AND TRIM(ip_address) <> ''
    GROUP BY 1
    ORDER BY visits DESC, clicks DESC, last_seen DESC
    LIMIT ${limit * 3}
  `);

  const ips = agg.map((r) => r.ip).filter(Boolean);
  const blacklisted = new Set<string>();
  /** Ledger canónico: Conversion aprovada ligada ao clique (não TrackingEvent conversion/sale). */
  const soldIps = new Set<string>();
  if (ips.length) {
    const bl = await systemPrisma.blacklistedIp.findMany({
      where: { userId: args.userId, ipAddress: { in: ips } },
      select: { ipAddress: true },
    });
    for (const row of bl) blacklisted.add(row.ipAddress.toLowerCase());

    const sold = await systemPrisma.$queryRaw<Array<{ ip: string }>>(Prisma.sql`
      SELECT DISTINCT
        CASE
          WHEN LOWER(TRIM(te.ip_address)) LIKE '::ffff:%'
            THEN SUBSTRING(LOWER(TRIM(te.ip_address)) FROM 8)
          ELSE LOWER(TRIM(te.ip_address))
        END AS ip
      FROM conversions c
      INNER JOIN tracking_events te ON te.id = c.click_id AND te.user_id = c.user_id
      WHERE c.user_id = ${args.userId}
        AND c.status = 'approved'
        AND c.created_at >= ${args.rangeStart}
        AND c.created_at <= ${args.rangeEnd}
        AND te.ip_address IS NOT NULL
        AND TRIM(te.ip_address) <> ''
    `);
    for (const row of sold) {
      if (row.ip) soldIps.add(row.ip);
    }
  }

  const matched: VisitorIpRow[] = [];
  for (const raw of agg) {
    const visits = Number(raw.visits ?? 0);
    const clicks = Number(raw.clicks ?? 0);
    if (visits <= 0 && clicks <= 0) continue;

    const meta = parseMeta(raw.metadata);
    const traffic_type = resolveTrafficType({
      source: raw.source,
      medium: raw.medium,
      utm_source: metaString(meta, "utm_source"),
      gclid: metaString(meta, "gclid"),
      msclkid: metaString(meta, "msclkid"),
      fbclid: metaString(meta, "fbclid"),
      ttclid: metaString(meta, "ttclid"),
      gbraid: metaString(meta, "gbraid"),
      wbraid: metaString(meta, "wbraid"),
    });
    if (!trafficMatches(traffic, traffic_type)) continue;

    const ev = resolveClickVisitorEvidence({
      ipAddress: raw.ip,
      userAgent: raw.user_agent,
      metadata: meta,
    });
    const is_cloud = ev.unqualified;
    const has_sale = soldIps.has(raw.ip);
    const flags = classifyVisitorIpFlags({
      visits,
      clicks,
      has_sale,
      is_bot: ev.is_bot,
      bot_label: ev.bot_label,
      is_cloud,
      traffic_type,
      country: raw.country,
    });

    matched.push({
      ip: raw.ip,
      last_seen: raw.last_seen.toISOString(),
      visits,
      clicks,
      country: raw.country,
      traffic_type,
      is_bot: ev.is_bot,
      bot_label: ev.bot_label,
      is_cloud,
      cloud_label: is_cloud ? ev.ip_network : null,
      is_suspect: flags.is_suspect,
      suspect_reasons: flags.suspect_reasons,
      has_sale,
      blacklisted: blacklisted.has(raw.ip),
      fuga_pct: flags.fuga_pct,
    });
  }

  // Suspeitos primeiro na lista; depois volume.
  matched.sort((a, b) => {
    if (a.is_suspect !== b.is_suspect) return a.is_suspect ? -1 : 1;
    if (b.visits !== a.visits) return b.visits - a.visits;
    return b.clicks - a.clicks;
  });

  const rows = matched.slice(0, limit);
  const totalVisits = matched.reduce((n, r) => n + r.visits, 0);
  const totalClicks = matched.reduce((n, r) => n + r.clicks, 0);
  const fuga_pct =
    totalVisits > 0
      ? Math.round(((totalVisits - Math.min(totalClicks, totalVisits)) / totalVisits) * 10000) / 100
      : null;

  const fromYmd =
    args.periodFrom ||
    `${args.rangeStart.getFullYear()}-${String(args.rangeStart.getMonth() + 1).padStart(2, "0")}-${String(args.rangeStart.getDate()).padStart(2, "0")}`;
  const toYmd =
    args.periodTo ||
    `${args.rangeEnd.getFullYear()}-${String(args.rangeEnd.getMonth() + 1).padStart(2, "0")}-${String(args.rangeEnd.getDate()).padStart(2, "0")}`;

  return {
    period: { from: fromYmd, to: toYmd },
    traffic_filter: traffic,
    summary: {
      visits: totalVisits,
      clicks: totalClicks,
      fuga_pct,
      bots: matched.filter((r) => r.is_bot).length,
      suspects: matched.filter((r) => r.is_suspect).length,
      cloud: matched.filter((r) => r.is_cloud).length,
      with_sale: matched.filter((r) => r.has_sale).length,
    },
    rows,
  };
}
