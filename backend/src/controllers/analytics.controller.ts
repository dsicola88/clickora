import { Request, Response } from "express";
import { Prisma, type EventType } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import { createPostbackToken } from "../lib/postbackToken";
import { publicApiBaseFromRequest } from "../lib/publicApiBase";
import {
  fetchGoogleAdsAccountMetrics,
  getGoogleAdsApiClientConfigFromEnv,
  isGoogleAdsClickUploadReadyForUser,
  isGoogleAdsMetricsReadyForUser,
} from "../modules/googleAds/googleAds.service";
import { fetchGoogleAdsInsightsBundle } from "../modules/googleAds/googleAdsInsights.service";
import { countryIsoFromIp } from "../lib/countryFromIp";
import { sendCsvDownload } from "../lib/csvExport";
import { decodeTimeIdCursor, encodeTimeIdCursor, whereOlderThanTimeIdCursor } from "../lib/cursorPagination";
import { isMetaCapiReadyForUser } from "../modules/metaCapi/metaCapi.service";

type AnalyticsSummaryItem = {
  presell_id: string;
  clicks: number;
  impressions: number;
  ctr: number;
  conversions: number;
  revenue: number;
};

/**
 * Data/hora em UTC para importação por cliques (GCLID), formato aceite pelo assistente de ficheiros do Google Ads
 * (ex.: yyyy-MM-dd HH:mm:ss+0000). Ver https://support.google.com/google-ads/answer/7014069
 */
function formatGoogleAdsOfflineImportCellTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+0000`;
}

/** Valor numérico até 2 casas decimais, como na documentação de «Conversion Value». */
function roundGoogleAdsOfflineImportValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function mapTrackingEventForApi(e: {
  id: string;
  presellPageId: string | null;
  eventType: EventType;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer: string | null;
  country: string | null;
  ipAddress: string | null;
  device: string | null;
  createdAt: Date;
  metadata: Prisma.JsonValue;
}) {
  const metadata = (e.metadata || {}) as Record<string, unknown>;
  const gclid = typeof metadata.gclid === "string" ? metadata.gclid : null;
  const msclkid = typeof metadata.msclkid === "string" ? metadata.msclkid : null;
  const fbclid = typeof metadata.fbclid === "string" ? metadata.fbclid : null;
  const ttclid = typeof metadata.ttclid === "string" ? metadata.ttclid : null;
  const paid = Boolean(
    gclid?.trim() || msclkid?.trim() || fbclid?.trim() || ttclid?.trim(),
  );
  const storedCountry = e.country && String(e.country).trim() ? String(e.country).trim().toUpperCase() : null;
  const country = storedCountry ?? countryIsoFromIp(e.ipAddress ?? null);
  const utm_content =
    typeof metadata.utm_content === "string" && metadata.utm_content.trim()
      ? metadata.utm_content.trim()
      : null;
  const utm_campaign =
    (e.campaign && String(e.campaign).trim()) ||
    (typeof metadata.campaign === "string" && metadata.campaign.trim() ? metadata.campaign.trim() : null);
  return {
    id: e.id,
    presell_id: e.presellPageId,
    event_type: e.eventType,
    source: e.source,
    medium: e.medium,
    campaign: e.campaign,
    referrer: e.referrer,
    country,
    ip_address: e.ipAddress,
    device: e.device,
    created_at: e.createdAt.toISOString(),
    metadata: e.metadata ?? {},
    utm_source: typeof metadata.utm_source === "string" ? metadata.utm_source : (e.source ?? null),
    utm_term: typeof metadata.utm_term === "string" ? metadata.utm_term : null,
    utm_content,
    utm_campaign: utm_campaign || null,
    gclid,
    msclkid,
    traffic_type: paid ? "paid" : "organic",
    is_bot: metadata.is_bot === true,
    bot_label: typeof metadata.bot_label === "string" ? metadata.bot_label : null,
  };
}

function mapConversionForApi(
  c: Prisma.ConversionGetPayload<{
    include: {
      click: {
        select: {
          id: true;
          metadata: true;
          source: true;
          medium: true;
          campaign: true;
          referrer: true;
        };
      };
    };
  }>,
) {
  const meta = (c.metadata || {}) as Record<string, unknown>;
  const clickMeta = (c.click.metadata || {}) as Record<string, unknown>;
  const gclid = typeof clickMeta.gclid === "string" ? clickMeta.gclid : null;
  const wbraid = typeof clickMeta.wbraid === "string" ? clickMeta.wbraid : null;
  const gbraid = typeof clickMeta.gbraid === "string" ? clickMeta.gbraid : null;
  const hasClickId = Boolean(gclid?.trim() || gbraid?.trim() || wbraid?.trim());
  const platform = typeof meta.platform === "string" ? meta.platform : "—";

  const utm_term_raw =
    (typeof clickMeta.utm_term === "string" && clickMeta.utm_term.trim() && clickMeta.utm_term.trim()) || "";
  const utm_content_raw =
    (typeof clickMeta.utm_content === "string" && clickMeta.utm_content.trim() && clickMeta.utm_content.trim()) || "";

  const clickSource =
    (c.click.source && String(c.click.source).trim()) ||
    (typeof clickMeta.utm_source === "string" && clickMeta.utm_source.trim() ? clickMeta.utm_source.trim() : "") ||
    null;
  const clickMedium =
    (c.click.medium && String(c.click.medium).trim()) ||
    (typeof clickMeta.medium === "string" && clickMeta.medium.trim() ? clickMeta.medium.trim() : "") ||
    null;
  const clickCampaign =
    (c.click.campaign && String(c.click.campaign).trim()) ||
    (typeof clickMeta.campaign === "string" && clickMeta.campaign.trim() ? clickMeta.campaign.trim() : "") ||
    null;

  const postbackCampaign = typeof c.campaign === "string" && c.campaign.trim() ? c.campaign.trim() : null;

  const keyword = utm_term_raw || postbackCampaign || "—";

  const originParts = [clickSource, clickMedium, clickCampaign].filter(Boolean);
  const origin = originParts.length ? originParts.join(" / ") : "—";

  const amount = c.amount != null ? Number(c.amount) : null;
  return {
    id: c.id,
    created_at: c.createdAt.toISOString(),
    click_id: c.clickId,
    presell_id: c.presellId,
    keyword,
    utm_source: clickSource,
    utm_medium: clickMedium,
    utm_campaign: clickCampaign,
    utm_term: utm_term_raw || null,
    utm_content: utm_content_raw || null,
    postback_campaign: postbackCampaign,
    origin,
    commission: amount != null && Number.isFinite(amount) ? amount : null,
    currency: c.currency ?? "USD",
    platform,
    google_ads_sync: c.googleAdsSync,
    meta_capi_sync: c.metaCapiSync,
    has_gclid: hasClickId,
    gclid: gclid || null,
  };
}

export const analyticsController = {
  async getSummary(req: Request, res: Response) {
    const { from, to, presell_id } = req.query;
    const userId = req.user!.userId;

    const where: Prisma.TrackingEventWhereInput = { userId };
    if (presell_id && typeof presell_id === "string") where.presellPageId = presell_id;
    if (from || to) {
      where.createdAt = {};
      if (from && typeof from === "string") where.createdAt.gte = new Date(from);
      if (to && typeof to === "string") where.createdAt.lte = new Date(to);
    }

    const events = await prisma.trackingEvent.groupBy({
      by: ["presellPageId", "eventType"],
      where,
      _count: true,
    });
    const conversionEvents = await prisma.trackingEvent.findMany({
      where: {
        ...where,
        eventType: { in: ["conversion", "sale"] },
      },
      select: { presellPageId: true, metadata: true },
    });

    const convWhere: Prisma.ConversionWhereInput = { userId, status: "approved" };
    if (presell_id && typeof presell_id === "string") convWhere.presellId = presell_id;
    if (from || to) {
      convWhere.createdAt = {};
      if (from && typeof from === "string") convWhere.createdAt.gte = new Date(from);
      if (to && typeof to === "string") convWhere.createdAt.lte = new Date(to);
    }
    const conversionRows = await prisma.conversion.groupBy({
      by: ["presellId"],
      where: convWhere,
      _count: true,
      _sum: { amount: true },
    });

    // Group by presell
    const summaryMap: Record<string, AnalyticsSummaryItem> = {};
    for (const e of events) {
      const pid = e.presellPageId || "unknown";
      if (!summaryMap[pid]) {
        summaryMap[pid] = { presell_id: pid, clicks: 0, impressions: 0, ctr: 0, conversions: 0, revenue: 0 };
      }
      if (e.eventType === "click") summaryMap[pid].clicks = e._count;
      if (e.eventType === "impression") summaryMap[pid].impressions = e._count;
    }
    for (const e of conversionEvents) {
      const pid = e.presellPageId || "unknown";
      if (!summaryMap[pid]) {
        summaryMap[pid] = { presell_id: pid, clicks: 0, impressions: 0, ctr: 0, conversions: 0, revenue: 0 };
      }
      summaryMap[pid].conversions += 1;
      const metadata = (e.metadata || {}) as Record<string, unknown>;
      const value = Number(metadata.value);
      if (Number.isFinite(value)) summaryMap[pid].revenue += value;
    }
    for (const c of conversionRows) {
      const pid = c.presellId;
      if (!summaryMap[pid]) {
        summaryMap[pid] = { presell_id: pid, clicks: 0, impressions: 0, ctr: 0, conversions: 0, revenue: 0 };
      }
      summaryMap[pid].conversions += c._count;
      const amt = c._sum.amount;
      if (amt != null) summaryMap[pid].revenue += Number(amt);
    }

    const result = Object.values(summaryMap).map((s) => ({
      ...s,
      ctr: s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0,
    }));

    res.json(result);
  },

  async getEvents(req: Request, res: Response) {
    const { event_type, presell_id, limit, from, to, format, cursor } = req.query;
    const userId = req.user!.userId;
    const formatStr = typeof format === "string" ? format.toLowerCase() : "";
    const wantCsv = formatStr === "csv" || formatStr === "text/csv";

    const where: Prisma.TrackingEventWhereInput = { userId };
    if (event_type && typeof event_type === "string") where.eventType = event_type as EventType;
    if (presell_id && typeof presell_id === "string") where.presellPageId = presell_id;
    if (from || to) {
      where.createdAt = {};
      if (from && typeof from === "string") {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0);
        if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (to && typeof to === "string") {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
      }
    }

    if (wantCsv) {
      const decoded = typeof cursor === "string" ? decodeTimeIdCursor(cursor) : null;
      if (cursor && typeof cursor === "string" && !decoded) {
        return res.status(400).json({ error: "cursor inválido" });
      }
      if (decoded) {
        where.AND = [whereOlderThanTimeIdCursor(decoded)];
      }

      const pageSize = Math.min(Math.max(Number(limit) || 10000, 1), 10000);
      const events = await prisma.trackingEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pageSize + 1,
      });

      const hasMore = events.length > pageSize;
      const page = hasMore ? events.slice(0, pageSize) : events;
      const rows = page.map((e) => mapTrackingEventForApi(e));

      const last = page.length > 0 ? page[page.length - 1]! : null;
      const nextCursor = hasMore && last ? encodeTimeIdCursor(last.createdAt, last.id) : null;

      const evLabel = event_type && typeof event_type === "string" ? String(event_type) : "all";
      const fromS = from && typeof from === "string" ? from : "start";
      const toS = to && typeof to === "string" ? to : "end";
      const filename = `tracking-events_${evLabel}_${fromS}_${toS}.csv`;
      const headers = [
        "id",
        "presell_id",
        "event_type",
        "created_at",
        "country",
        "source",
        "medium",
        "campaign",
        "referrer",
        "utm_source",
        "utm_term",
        "utm_content",
        "utm_campaign",
        "device",
        "ip_address",
        "traffic_type",
        "gclid",
        "msclkid",
        "is_bot",
        "bot_label",
        "metadata_json",
      ];
      const dataRows = rows.map((r) => {
        const metaJson = JSON.stringify(r.metadata ?? {});
        return [
          r.id,
          r.presell_id,
          r.event_type,
          r.created_at,
          r.country,
          r.source,
          r.medium,
          r.campaign,
          r.referrer,
          r.utm_source,
          r.utm_term,
          r.utm_content,
          r.utm_campaign,
          r.device,
          r.ip_address,
          r.traffic_type,
          r.gclid,
          r.msclkid,
          r.is_bot,
          r.bot_label,
          metaJson,
        ];
      });
      return sendCsvDownload(res, filename, headers, dataRows, { nextCursor });
    }

    const take = Math.min(Number(limit) || 200, 500);
    const events = await prisma.trackingEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    });
    const rows = events.map((e) => mapTrackingEventForApi(e));
    res.json(rows);
  },

  /** Lista conversões aprovadas (postback) com dados do clique e sync Google Ads / Meta CAPI. */
  async listConversions(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { from, to, missing_gclid, limit, format, cursor } = req.query;
    const formatStr = typeof format === "string" ? format.toLowerCase() : "";
    const wantCsv = formatStr === "csv" || formatStr === "text/csv";
    const wantMissingGclid = missing_gclid === "1" || missing_gclid === "true";

    const csvHeaders = [
      "id",
      "created_at",
      "click_id",
      "presell_id",
      "origin",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "postback_campaign",
      "keyword",
      "commission",
      "currency",
      "platform",
      "google_ads_sync",
      "meta_capi_sync",
      "has_gclid",
      "gclid",
    ];

    const buildConversionWhere = (): Prisma.ConversionWhereInput => {
      const where: Prisma.ConversionWhereInput = { userId, status: "approved" };
      if (from || to) {
        where.createdAt = {};
        if (from && typeof from === "string") {
          const d = new Date(from);
          d.setHours(0, 0, 0, 0);
          if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
        }
        if (to && typeof to === "string") {
          const d = new Date(to);
          d.setHours(23, 59, 59, 999);
          if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
        }
      }
      return where;
    };

    const clickInclude = {
      click: {
        select: {
          id: true,
          metadata: true,
          source: true,
          medium: true,
          campaign: true,
          referrer: true,
        },
      },
    } as const;

    /** CSV + sem gclid: filtro em SQL + cursor (não depende de pós-filtro na memória). */
    if (wantCsv && wantMissingGclid) {
      const decoded = typeof cursor === "string" ? decodeTimeIdCursor(cursor) : null;
      if (cursor && typeof cursor === "string" && !decoded) {
        return res.status(400).json({ error: "cursor inválido" });
      }

      const pageSize = Math.min(Math.max(Number(limit) || 10000, 1), 10000);

      let fromD: Date | undefined;
      let toD: Date | undefined;
      if (from && typeof from === "string") {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0);
        if (!Number.isNaN(d.getTime())) fromD = d;
      }
      if (to && typeof to === "string") {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        if (!Number.isNaN(d.getTime())) toD = d;
      }

      const cursorSql = decoded
        ? Prisma.sql`AND (
            c.created_at < ${new Date(decoded.t)}::timestamptz
            OR (c.created_at = ${new Date(decoded.t)}::timestamptz AND c.id < ${decoded.id}::uuid)
          )`
        : Prisma.sql``;

      const fromSql = fromD ? Prisma.sql`AND c.created_at >= ${fromD}::timestamptz` : Prisma.sql``;
      const toSql = toD ? Prisma.sql`AND c.created_at <= ${toD}::timestamptz` : Prisma.sql``;

      const idRows = await prisma.$queryRaw<{ id: string; created_at: Date }[]>(Prisma.sql`
        SELECT c.id, c.created_at
        FROM conversions c
        INNER JOIN tracking_events t ON t.id = c.click_id
        WHERE c.user_id = ${userId}::uuid
        AND c.status = 'approved'
        AND (
          NULLIF(TRIM(COALESCE(t.metadata->>'gclid', '')), '') IS NULL
          AND NULLIF(TRIM(COALESCE(t.metadata->>'gbraid', '')), '') IS NULL
          AND NULLIF(TRIM(COALESCE(t.metadata->>'wbraid', '')), '') IS NULL
        )
        ${fromSql}
        ${toSql}
        ${cursorSql}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT ${pageSize + 1}
      `);

      const hasMore = idRows.length > pageSize;
      const slice = idRows.slice(0, pageSize);
      const ids = slice.map((r) => r.id);

      const fromS = from && typeof from === "string" ? from : "start";
      const toS = to && typeof to === "string" ? to : "end";
      const filename = `conversions_no-click-id_${fromS}_${toS}.csv`;

      if (ids.length === 0) {
        return sendCsvDownload(res, filename, csvHeaders, [], { nextCursor: null });
      }

      const convRows = await prisma.conversion.findMany({
        where: { id: { in: ids } },
        include: clickInclude,
      });
      const order = new Map(ids.map((id, i) => [id, i]));
      convRows.sort((a, b) => (order.get(a.id)! - order.get(b.id)!));

      const filtered = convRows.map((c) => mapConversionForApi(c));
      const dataRows = filtered.map((r) => [
        r.id,
        r.created_at,
        r.click_id,
        r.presell_id,
        r.origin,
        r.utm_source,
        r.utm_medium,
        r.utm_campaign,
        r.utm_term,
        r.utm_content,
        r.postback_campaign,
        r.keyword,
        r.commission,
        r.currency,
        r.platform,
        r.google_ads_sync,
        r.meta_capi_sync,
        r.has_gclid,
        r.gclid,
      ]);

      const last = slice[slice.length - 1]!;
      const nextCursor = hasMore ? encodeTimeIdCursor(new Date(last.created_at), last.id) : null;
      return sendCsvDownload(res, filename, csvHeaders, dataRows, { nextCursor });
    }

    if (wantCsv && !wantMissingGclid) {
      const decoded = typeof cursor === "string" ? decodeTimeIdCursor(cursor) : null;
      if (cursor && typeof cursor === "string" && !decoded) {
        return res.status(400).json({ error: "cursor inválido" });
      }

      const where = buildConversionWhere();
      if (decoded) {
        where.AND = [whereOlderThanTimeIdCursor(decoded)];
      }

      const pageSize = Math.min(Math.max(Number(limit) || 10000, 1), 10000);
      const rows = await prisma.conversion.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pageSize + 1,
        include: clickInclude,
      });

      const hasMore = rows.length > pageSize;
      const page = hasMore ? rows.slice(0, pageSize) : rows;
      const filtered = page.map((c) => mapConversionForApi(c));

      const last = page.length > 0 ? page[page.length - 1]! : null;
      const nextCursor = hasMore && last ? encodeTimeIdCursor(last.createdAt, last.id) : null;

      const fromS = from && typeof from === "string" ? from : "start";
      const toS = to && typeof to === "string" ? to : "end";
      const filename = `conversions_${fromS}_${toS}.csv`;
      const dataRows = filtered.map((r) => [
        r.id,
        r.created_at,
        r.click_id,
        r.presell_id,
        r.origin,
        r.utm_source,
        r.utm_medium,
        r.utm_campaign,
        r.utm_term,
        r.utm_content,
        r.postback_campaign,
        r.keyword,
        r.commission,
        r.currency,
        r.platform,
        r.google_ads_sync,
        r.meta_capi_sync,
        r.has_gclid,
        r.gclid,
      ]);
      return sendCsvDownload(res, filename, csvHeaders, dataRows, { nextCursor });
    }

    const where = buildConversionWhere();
    const take = Math.min(Number(limit) || (wantMissingGclid ? 2000 : 200), wantMissingGclid ? 3000 : 500);

    const rows = await prisma.conversion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: clickInclude,
    });

    const out = rows.map((c) => mapConversionForApi(c));
    const filtered = wantMissingGclid ? out.filter((r) => !r.has_gclid) : out;
    res.json(filtered);
  },

  async getDashboard(req: Request, res: Response) {
    const userId = req.user!.userId;
    const fromQ = req.query.from?.toString();
    const toQ = req.query.to?.toString();

    const endOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    };

    let rangeStart: Date;
    let rangeEnd: Date;
    if (fromQ && toQ) {
      rangeStart = new Date(fromQ);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = endOfDay(new Date(toQ));
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
        return res.status(400).json({ error: "Intervalo de datas inválido (use from e to em formato YYYY-MM-DD)" });
      }
    } else {
      rangeEnd = endOfDay(new Date());
      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeStart.getDate() - 14);
      rangeStart.setHours(0, 0, 0, 0);
    }

    try {
    const [aggRow, linkedRow, platformDistRow, chartRows, geoRows] = await Promise.all([
      // Uma passagem na tabela: contagens + receita em metadata (evita findMany gigante + 502 no proxy).
      systemPrisma.$queryRaw<
        Array<{
          clicks: bigint;
          impressions: bigint;
          tracking_conversions: bigint;
          revenue_tracking: unknown;
        }>
      >(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type::text = 'click') AS clicks,
          COUNT(*) FILTER (WHERE event_type::text = 'impression') AS impressions,
          COUNT(*) FILTER (WHERE event_type::text IN ('conversion', 'sale')) AS tracking_conversions,
          COALESCE(
            SUM(
              CASE
                WHEN event_type::text IN ('conversion', 'sale')
                  AND (metadata->>'value') IS NOT NULL
                  AND TRIM(metadata->>'value') ~ '^-?[0-9]+(\\.[0-9]*)?$'
                THEN (metadata->>'value')::double precision
                ELSE 0::double precision
              END
            ),
            0::double precision
          ) AS revenue_tracking
        FROM tracking_events
        WHERE user_id = ${userId}
          AND created_at >= ${rangeStart}
          AND created_at <= ${rangeEnd}
      `),
      systemPrisma.$queryRaw<Array<{ cnt: bigint; revenue_sum: unknown }>>(Prisma.sql`
        SELECT
          COUNT(*)::bigint AS cnt,
          COALESCE(SUM(amount), 0) AS revenue_sum
        FROM conversions
        WHERE user_id = ${userId}
          AND status = 'approved'
          AND created_at >= ${rangeStart}
          AND created_at <= ${rangeEnd}
      `),
      systemPrisma.$queryRaw<Array<{ cnt: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT LOWER(TRIM(metadata->>'platform')))::bigint AS cnt
        FROM conversions
        WHERE user_id = ${userId}
          AND status = 'approved'
          AND created_at >= ${rangeStart}
          AND created_at <= ${rangeEnd}
          AND metadata IS NOT NULL
          AND TRIM(COALESCE(metadata->>'platform', '')) <> ''
      `),
      systemPrisma.$queryRaw<Array<{ day: Date; event_type: string; ct: bigint }>>(Prisma.sql`
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
               event_type::text AS event_type,
               COUNT(*)::bigint AS ct
        FROM tracking_events
        WHERE user_id = ${userId}
          AND created_at >= ${rangeStart}
          AND created_at <= ${rangeEnd}
          AND event_type::text IN ('click', 'impression')
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `),
      systemPrisma.$queryRaw<Array<{ country: string | null; ct: bigint }>>(Prisma.sql`
        SELECT country,
               COUNT(*)::bigint AS ct
        FROM tracking_events
        WHERE user_id = ${userId}
          AND created_at >= ${rangeStart}
          AND created_at <= ${rangeEnd}
          AND event_type::text = 'click'
        GROUP BY country
        ORDER BY ct DESC
        LIMIT 25
      `),
    ]);

    /** Colunas de integração em `users` podem faltar na BD (P2022) — não pode derrubar o dashboard inteiro. */
    type PipelineUser = {
      googleAdsEnabled: boolean;
      googleAdsCustomerId: string | null;
      googleAdsConversionActionId: string | null;
      googleAdsLoginCustomerId: string | null;
      googleAdsRefreshToken: string | null;
      metaCapiEnabled: boolean;
      metaPixelId: string | null;
      metaAccessToken: string | null;
    };
    let pipelineUser: PipelineUser | null = null;
    try {
      pipelineUser = await systemPrisma.user.findUnique({
        where: { id: userId },
        select: {
          googleAdsEnabled: true,
          googleAdsCustomerId: true,
          googleAdsConversionActionId: true,
          googleAdsLoginCustomerId: true,
          googleAdsRefreshToken: true,
          metaCapiEnabled: true,
          metaPixelId: true,
          metaAccessToken: true,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
        console.warn("[analytics.getDashboard] users.* integration columns missing (P2022); pipeline flags off");
      } else {
        throw e;
      }
    }

    const a = aggRow[0];
    const clicks = Number(a?.clicks ?? 0);
    const impressions = Number(a?.impressions ?? 0);
    const trackingConversions = Number(a?.tracking_conversions ?? 0);
    const revenueTracking = Number(a?.revenue_tracking ?? 0);

    const l = linkedRow[0];
    const linkedConvCount = Number(l?.cnt ?? 0);
    const revenueLinked = l?.revenue_sum != null ? Number(l.revenue_sum) : 0;
    const revenue = revenueTracking + revenueLinked;
    const affiliatePlatformsCount = Number(platformDistRow[0]?.cnt ?? 0);
    const conversions = trackingConversions + linkedConvCount;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    const chartMap: Record<string, { clicks: number; impressions: number }> = {};
    for (const row of chartRows) {
      const date =
        row.day instanceof Date ? row.day.toISOString().split("T")[0] : String(row.day).slice(0, 10);
      if (!chartMap[date]) chartMap[date] = { clicks: 0, impressions: 0 };
      const n = Number(row.ct);
      if (row.event_type === "click") chartMap[date].clicks = n;
      if (row.event_type === "impression") chartMap[date].impressions = n;
    }

    const chart_data = Object.entries(chartMap)
      .map(([date, data]) => ({
        date,
        clicks: data.clicks,
        impressions: data.impressions,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const apiBase = publicApiBaseFromRequest(req);
    const postbackToken = createPostbackToken(userId);

    const googleAdsLive = pipelineUser ? isGoogleAdsClickUploadReadyForUser(pipelineUser) : false;
    const metaCapiLive = pipelineUser ? isMetaCapiReadyForUser(pipelineUser) : false;

    let google_ads_metrics: {
      impressions: number;
      clicks: number;
      conversions: number;
      cost_micros: number;
    } | null = null;
    let google_ads_metrics_error: string | null = null;

    if (pipelineUser && isGoogleAdsMetricsReadyForUser(pipelineUser)) {
      const g = await fetchGoogleAdsAccountMetrics({
        user: pipelineUser,
        from: rangeStart,
        to: rangeEnd,
      });
      if (g.ok) {
        google_ads_metrics = g.metrics;
      } else {
        google_ads_metrics_error = g.error;
      }
    }

    const clicks_by_country = geoRows.map((row) => {
      const raw = row.country?.trim();
      if (!raw) return { country_code: null as string | null, clicks: Number(row.ct) };
      const u = raw.toUpperCase();
      const country_code = u.length === 2 && /^[A-Z]{2}$/.test(u) ? u : null;
      return { country_code, clicks: Number(row.ct) };
    });

    /** Observabilidade: conversões com envio Google/Meta falhado nos últimos 7 dias (UTC). */
    const syncHealthStart = new Date();
    syncHealthStart.setUTCDate(syncHealthStart.getUTCDate() - 7);
    syncHealthStart.setUTCHours(0, 0, 0, 0);
    let sync_health: {
      period_days: number;
      google_ads_failed: number;
      meta_capi_failed: number;
    } = { period_days: 7, google_ads_failed: 0, meta_capi_failed: 0 };
    try {
      const [sh] = await systemPrisma.$queryRaw<Array<{ g: bigint | null; m: bigint | null }>>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE google_ads_sync = 'failed')::bigint AS g,
          COUNT(*) FILTER (WHERE meta_capi_sync = 'failed')::bigint AS m
        FROM conversions
        WHERE user_id = ${userId}::uuid
          AND status = 'approved'
          AND created_at >= ${syncHealthStart}
      `);
      sync_health = {
        period_days: 7,
        google_ads_failed: Number(sh?.g ?? 0),
        meta_capi_failed: Number(sh?.m ?? 0),
      };
    } catch (e) {
      console.warn("[analytics.getDashboard] sync_health indisponível (colunas ou BD)", e);
    }

    res.json({
      total_clicks: clicks,
      total_impressions: impressions,
      total_conversions: conversions,
      ctr: Math.round(ctr * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      /** Vendas aprovadas ligadas a postbacks (tabela conversions). */
      approved_sales_count: linkedConvCount,
      /** Plataformas de afiliado distintas (metadata.platform) com pelo menos uma venda no período. */
      affiliate_platforms_count: affiliatePlatformsCount,
      chart_data,
      period: {
        from: rangeStart.toISOString().split("T")[0],
        to: rangeEnd.toISOString().split("T")[0],
      },
      tracking_install: {
        user_id: userId,
        embed_js_url: `${apiBase}/track/v2/clickora.min.js`,
        csv_upload_url: `${apiBase}/track/conversions/csv?token=${encodeURIComponent(postbackToken)}`,
        affiliate_webhook_path: "/integrations/affiliate-webhook",
        google_ads_postback_path: "/track/postback/google-ads",
      },
      tracking_pipeline: {
        click_tracking: true,
        campaign_tracking: true,
        sale_tracking: true,
        google_ads_integration: googleAdsLive,
        google_ads_api_env_configured: Boolean(getGoogleAdsApiClientConfigFromEnv()),
        google_ads_metrics_available: pipelineUser ? isGoogleAdsMetricsReadyForUser(pipelineUser) : false,
        meta_capi_integration: metaCapiLive,
      },
      google_ads_metrics,
      google_ads_metrics_error,
      clicks_by_country,
      sync_health,
    });
    } catch (e) {
      console.error("[analytics.getDashboard]", e);
      return res.status(503).json({
        error: "O painel de analytics não está disponível de momento. Tente novamente dentro de alguns instantes.",
        code: "dashboard_unavailable",
      });
    }
  },

  /**
   * Relatórios Google Ads (GAQL): palavras-chave, termos de pesquisa, demografia.
   * Mesmo intervalo `from`/`to` (YYYY-MM-DD) para os três blocos; dados em tempo real da API (sem cache).
   */
  async getGoogleAdsInsights(req: Request, res: Response) {
    const userId = req.user!.userId;
    const fromQ = req.query.from?.toString();
    const toQ = req.query.to?.toString();

    const endOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(23, 59, 59, 999);
      return x;
    };

    let rangeStart: Date;
    let rangeEnd: Date;
    if (fromQ && toQ) {
      rangeStart = new Date(fromQ);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd = endOfDay(new Date(toQ));
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
        return res.status(400).json({
          error:
            "O intervalo de datas não é válido. Utilize «from» e «to» no formato YYYY-MM-DD, com data de início anterior ou igual à data de fim.",
          code: "google_ads_insights_invalid_range",
        });
      }
    } else {
      rangeEnd = endOfDay(new Date());
      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeStart.getDate() - 30);
      rangeStart.setHours(0, 0, 0, 0);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleAdsCustomerId: true,
        googleAdsLoginCustomerId: true,
        googleAdsRefreshToken: true,
      },
    });
    if (!user) {
      return res.status(404).json({
        error: "Não foi possível localizar a conta de utilizador.",
        code: "user_not_found",
      });
    }

    const bundle = await fetchGoogleAdsInsightsBundle({
      user,
      from: rangeStart,
      to: rangeEnd,
    });
    if (!bundle.ok) {
      return res.status(503).json({
        error: bundle.error,
        code: bundle.code,
      });
    }
    return res.json(bundle.data);
  },

  /**
   * CSV para Google Ads → Conversões → importar conversões a partir de cliques (GCLID).
   * Cabeçalhos: Google Click ID, Conversion Name, Conversion Time, Conversion Value, Conversion Currency.
   * @see https://support.google.com/google-ads/answer/7014069
   */
  async getGoogleAdsOfflineImportCsv(req: Request, res: Response) {
    const userId = req.user!.userId;
    const fromQ = req.query.from?.toString();
    const toQ = req.query.to?.toString();
    const conversionNameRaw = req.query.conversion_name?.toString()?.trim();
    const includeAffiliate = req.query.include_affiliate !== "0" && req.query.include_affiliate !== "false";

    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const conversionIdsRaw = req.query.conversion_ids;
    let selectedConversionIds: string[] | null = null;
    if (conversionIdsRaw !== undefined && conversionIdsRaw !== null) {
      const raw = Array.isArray(conversionIdsRaw) ? conversionIdsRaw.join(",") : String(conversionIdsRaw);
      const parts = raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      selectedConversionIds = [...new Set(parts.filter((id) => uuidRe.test(id)))].slice(0, 500);
      if (selectedConversionIds.length === 0) {
        return res.status(400).json({
          error:
            "Indique conversion_ids com UUIDs de conversões (máx. 500), separados por vírgula, no mesmo intervalo de datas.",
        });
      }
    }

    if (!fromQ || !toQ) {
      return res.status(400).json({ error: "Indique from e to em formato YYYY-MM-DD." });
    }
    if (!conversionNameRaw) {
      return res.status(400).json({
        error:
          "Indique conversion_name com o nome exacto da ação de conversão em Google Ads (Ferramentas → Conversões).",
      });
    }

    const rangeStart = new Date(fromQ);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(toQ);
    rangeEnd.setHours(23, 59, 59, 999);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
      return res.status(400).json({ error: "Intervalo de datas inválido." });
    }

    type Row = { gclid: string; at: Date; value: number; currency: string };
    const out: Row[] = [];

    if (selectedConversionIds) {
      const sales = await prisma.conversion.findMany({
        where: {
          userId,
          status: "approved",
          id: { in: selectedConversionIds },
          createdAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: {
          id: true,
          createdAt: true,
          amount: true,
          currency: true,
          click: { select: { metadata: true } },
        },
      });
      if (sales.length !== selectedConversionIds.length) {
        return res.status(400).json({
          error:
            "Uma ou mais conversões não existem, não estão aprovadas ou não pertencem ao intervalo de datas indicado.",
        });
      }
      for (const c of sales) {
        const meta = (c.click.metadata || {}) as Record<string, unknown>;
        const gclid = typeof meta.gclid === "string" ? meta.gclid.trim() : "";
        if (!gclid) continue;
        const value = c.amount != null ? Number(c.amount) : 0;
        const cur = (c.currency || "USD").toUpperCase().slice(0, 3);
        out.push({ gclid, at: c.createdAt, value, currency: cur });
      }
      if (out.length === 0) {
        return res.status(400).json({
          error:
            "Nenhuma conversão seleccionada tem GCLID no clique associado. Só linhas com identificador Google podem ser importadas por ficheiro.",
        });
      }
    } else {
      const trackingConversions = await prisma.trackingEvent.findMany({
        where: {
          userId,
          eventType: "conversion",
          createdAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { createdAt: true, metadata: true },
      });

      for (const e of trackingConversions) {
        const meta = (e.metadata || {}) as Record<string, unknown>;
        const gclid = typeof meta.gclid === "string" ? meta.gclid.trim() : "";
        if (!gclid) continue;
        const rawVal = meta.value;
        const value =
          typeof rawVal === "number"
            ? rawVal
            : Number.parseFloat(String(rawVal ?? "0").replace(",", ".")) || 0;
        const cur =
          typeof meta.currency === "string" && meta.currency.trim()
            ? meta.currency.trim().toUpperCase().slice(0, 3)
            : "USD";
        out.push({ gclid, at: e.createdAt, value, currency: cur });
      }

      if (includeAffiliate) {
        const sales = await prisma.conversion.findMany({
          where: {
            userId,
            status: "approved",
            createdAt: { gte: rangeStart, lte: rangeEnd },
          },
          select: {
            createdAt: true,
            amount: true,
            currency: true,
            click: { select: { metadata: true } },
          },
        });
        for (const c of sales) {
          const meta = (c.click.metadata || {}) as Record<string, unknown>;
          const gclid = typeof meta.gclid === "string" ? meta.gclid.trim() : "";
          if (!gclid) continue;
          const value = c.amount != null ? Number(c.amount) : 0;
          const cur = (c.currency || "USD").toUpperCase().slice(0, 3);
          out.push({ gclid, at: c.createdAt, value, currency: cur });
        }
      }
    }

    out.sort((a, b) => a.at.getTime() - b.at.getTime());

    const headers = [
      "Google Click ID",
      "Conversion Name",
      "Conversion Time",
      "Conversion Value",
      "Conversion Currency",
    ];
    const rows = out.map((r) => [
      r.gclid,
      conversionNameRaw,
      formatGoogleAdsOfflineImportCellTime(r.at),
      roundGoogleAdsOfflineImportValue(r.value),
      r.currency,
    ]);

    const filename =
      selectedConversionIds != null
        ? `google-ads-offline-gclid_${fromQ}_${toQ}_selecao.csv`
        : `google-ads-offline-gclid_${fromQ}_${toQ}.csv`;
    sendCsvDownload(res, filename, headers, rows);
  },

  /** Tentativas bloqueadas: blacklist ou regras de tracking (rate limit, whitelist, UA, bots). */
  async getBlacklistBlocks(req: Request, res: Response) {
    const userId = req.user!.userId;
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const logs = await prisma.postbackLog.findMany({
      where: { userId, platform: { in: ["blacklist_block", "tracking_guard"] } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        message: true,
        payload: true,
        presellPageId: true,
      },
    });
    res.json(
      logs.map((l) => {
        const p = (l.payload || {}) as Record<string, unknown>;
        return {
          id: l.id,
          created_at: l.createdAt.toISOString(),
          message: l.message,
          presell_id: l.presellPageId,
          ip: typeof p.ip === "string" ? p.ip : null,
          channel: typeof p.channel === "string" ? p.channel : null,
          user_agent: typeof p.user_agent === "string" ? p.user_agent : null,
          guard_reason: typeof p.reason === "string" ? p.reason : null,
        };
      }),
    );
  },
};
