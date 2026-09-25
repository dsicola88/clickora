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
import { fetchGoogleAdsInsightsBundle, fetchGoogleAdsKeywordInsights } from "../modules/googleAds/googleAdsInsights.service";
import {
  sumPersistedAdGroupCosts,
  sumPersistedKeywordCosts,
  sumPersistedSpend,
} from "../modules/affiliateOps/costSync.service";
import { countryIsoFromIp, geoLookupFromIp } from "../lib/countryFromIp";
import { resolveTrafficType } from "../lib/networkClickId";
import { isUnreplacedAdMacro, normalizeUtmDimension } from "../lib/adUrlMacros";
import { sendCsvDownload } from "../lib/csvExport";
import { decodeTimeIdCursor, encodeTimeIdCursor, whereOlderThanTimeIdCursor } from "../lib/cursorPagination";
import { isMetaCapiReadyForUser } from "../modules/metaCapi/metaCapi.service";
import { isTikTokEventsReadyForUser } from "../modules/tiktokEvents/tiktokEvents.service";
import { billingUserId } from "../lib/requestContext";
import { buildMediaBuyerAlerts, computePerf } from "../lib/campaignPerf";
import { buildAccountHealth, loadPeriodSnapshot } from "../lib/accountHealth";

type AnalyticsSummaryItem = {
  presell_id: string;
  clicks: number;
  impressions: number;
  ctr: number;
  conversions: number;
  revenue: number;
  /** Conversões / cliques (0–100). */
  conversion_rate: number;
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
  const utm_source =
    typeof metadata.utm_source === "string" ? metadata.utm_source : (e.source ?? null);
  const rawTerm = typeof metadata.utm_term === "string" ? metadata.utm_term.trim() : "";
  const rawContent = typeof metadata.utm_content === "string" ? metadata.utm_content.trim() : "";
  const geo = geoLookupFromIp(e.ipAddress ?? null);
  const storedCountry = e.country && String(e.country).trim() ? String(e.country).trim().toUpperCase() : null;
  const country = storedCountry ?? geo?.country_code ?? countryIsoFromIp(e.ipAddress ?? null);
  const utm_campaign =
    (e.campaign && String(e.campaign).trim()) ||
    (typeof metadata.campaign === "string" && metadata.campaign.trim() ? metadata.campaign.trim() : null) ||
    (typeof metadata.utm_campaign === "string" && metadata.utm_campaign.trim()
      ? metadata.utm_campaign.trim()
      : null);
  const traffic_type = resolveTrafficType({
    source: e.source,
    medium: e.medium,
    utm_source,
    gclid,
    msclkid,
    fbclid,
    ttclid,
  });
  return {
    id: e.id,
    presell_id: e.presellPageId,
    event_type: e.eventType,
    source: e.source,
    medium: e.medium,
    campaign: e.campaign,
    referrer: e.referrer,
    country,
    /** Região GeoIP (código MaxMind, ex. CA) quando o IP resolve. */
    region: geo?.region?.trim() || null,
    city: geo?.city?.trim() || null,
    ip_address: e.ipAddress,
    device: e.device,
    created_at: e.createdAt.toISOString(),
    metadata: e.metadata ?? {},
    utm_source,
    /** Valor bruto (inclui macros literais) — Relatórios mostram a verdade. */
    utm_term: rawTerm || null,
    utm_term_macro: isUnreplacedAdMacro(rawTerm),
    utm_content: rawContent || null,
    utm_content_macro: isUnreplacedAdMacro(rawContent),
    utm_campaign: utm_campaign || null,
    gclid,
    msclkid,
    traffic_type,
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
  const clickMeta = (c.click?.metadata || {}) as Record<string, unknown>;
  const gclid = typeof clickMeta.gclid === "string" ? clickMeta.gclid : null;
  const wbraid = typeof clickMeta.wbraid === "string" ? clickMeta.wbraid : null;
  const gbraid = typeof clickMeta.gbraid === "string" ? clickMeta.gbraid : null;
  const msclkid = typeof clickMeta.msclkid === "string" ? clickMeta.msclkid : null;
  const hasClickId = Boolean(
    (gclid && gclid.trim() && !/^\{/.test(gclid.trim())) ||
      (gbraid && gbraid.trim() && !/^\{/.test(gbraid.trim())) ||
      (wbraid && wbraid.trim() && !/^\{/.test(wbraid.trim())) ||
      (msclkid && msclkid.trim() && !/^\{/.test(msclkid.trim())),
  );
  const platform = typeof meta.platform === "string" ? meta.platform : "—";

  const utm_term_raw = normalizeUtmDimension(
    typeof clickMeta.utm_term === "string" ? clickMeta.utm_term : null,
  ) || "";
  const utm_content_raw = normalizeUtmDimension(
    typeof clickMeta.utm_content === "string" ? clickMeta.utm_content : null,
  ) || "";

  const clickSource = c.click
    ? (c.click.source && String(c.click.source).trim()) ||
      (typeof clickMeta.utm_source === "string" && clickMeta.utm_source.trim() ? clickMeta.utm_source.trim() : "") ||
      null
    : null;
  const clickMedium = c.click
    ? (c.click.medium && String(c.click.medium).trim()) ||
      (typeof clickMeta.medium === "string" && clickMeta.medium.trim() ? clickMeta.medium.trim() : "") ||
      null
    : null;
  const clickCampaign = c.click
    ? (c.click.campaign && String(c.click.campaign).trim()) ||
      (typeof clickMeta.campaign === "string" && clickMeta.campaign.trim() ? clickMeta.campaign.trim() : "") ||
      null
    : null;

  const postbackCampaign = typeof c.campaign === "string" && c.campaign.trim() ? c.campaign.trim() : null;

  /** Keyword = só utm_term do clique; nunca misturar com campanha do postback. */
  const keyword = utm_term_raw || "—";

  const originParts = [clickSource, clickMedium, clickCampaign].filter(Boolean);
  const origin =
    c.attribution === "unattributed"
      ? "não atribuída"
      : originParts.length
        ? originParts.join(" / ")
        : "—";

  const amount = c.amount != null ? Number(c.amount) : null;
  return {
    id: c.id,
    created_at: c.createdAt.toISOString(),
    click_id: c.clickId,
    presell_id: c.presellId,
    attribution: c.attribution,
    external_order_id: c.externalOrderId,
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
    tiktok_events_sync: c.tiktokEventsSync,
    has_gclid: hasClickId,
    gclid: gclid || null,
  };
}

/**
 * Prisma `NOT { metadata path equals true }` gera SQL com NULL → exclui eventos
 * sem a chave `is_bot` / `exclude_from_kpi` (quase todos). O dashboard usa COALESCE;
 * estes helpers alinham Relatórios ao mesmo critério.
 */
function sqlExcludeBotAndKpiNoise(includeBots: boolean): Prisma.Sql {
  if (includeBots) return Prisma.empty;
  return Prisma.sql`
    AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
    AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
  `;
}

type TrackingEventListRow = {
  id: string;
  presell_page_id: string | null;
  event_type: EventType;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer: string | null;
  country: string | null;
  ip_address: string | null;
  device: string | null;
  created_at: Date;
  metadata: Prisma.JsonValue;
};

function mapDbTrackingEventRow(r: TrackingEventListRow) {
  return mapTrackingEventForApi({
    id: r.id,
    presellPageId: r.presell_page_id,
    eventType: r.event_type,
    source: r.source,
    medium: r.medium,
    campaign: r.campaign,
    referrer: r.referrer,
    country: r.country,
    ipAddress: r.ip_address,
    device: r.device,
    createdAt: r.created_at,
    metadata: r.metadata,
  });
}

export const analyticsController = {
  async getSummary(req: Request, res: Response) {
    const { from, to, presell_id } = req.query;
    const userId = billingUserId(req);

    const rangeStart =
      from && typeof from === "string" && !Number.isNaN(new Date(from).getTime())
        ? new Date(from)
        : null;
    const rangeEnd =
      to && typeof to === "string" && !Number.isNaN(new Date(to).getTime()) ? new Date(to) : null;
    const presellId = presell_id && typeof presell_id === "string" ? presell_id : null;

    const eventRows = await systemPrisma.$queryRaw<
      Array<{ presell_page_id: string | null; event_type: string; cnt: bigint }>
    >(Prisma.sql`
      SELECT presell_page_id, event_type::text AS event_type, COUNT(*)::bigint AS cnt
      FROM tracking_events
      WHERE user_id = ${userId}
        ${presellId ? Prisma.sql`AND presell_page_id = ${presellId}` : Prisma.empty}
        ${rangeStart ? Prisma.sql`AND created_at >= ${rangeStart}` : Prisma.empty}
        ${rangeEnd ? Prisma.sql`AND created_at <= ${rangeEnd}` : Prisma.empty}
        ${sqlExcludeBotAndKpiNoise(false)}
      GROUP BY presell_page_id, event_type
    `);

    const events = eventRows.map((r) => ({
      presellPageId: r.presell_page_id,
      eventType: r.event_type as EventType,
      _count: Number(r.cnt),
    }));

    const convWhere: Prisma.ConversionWhereInput = { userId, status: "approved" };
    if (presellId) convWhere.presellId = presellId;
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

    // Group by presell (+ bucket explícito para vendas sem atribuição)
    const empty = (pid: string): AnalyticsSummaryItem => ({
      presell_id: pid,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      conversions: 0,
      revenue: 0,
      conversion_rate: 0,
    });
    const summaryMap: Record<string, AnalyticsSummaryItem> = {};
    for (const e of events) {
      const pid = e.presellPageId || "unknown";
      if (!summaryMap[pid]) summaryMap[pid] = empty(pid);
      if (e.eventType === "click") summaryMap[pid].clicks = e._count;
      if (e.eventType === "impression") summaryMap[pid].impressions = e._count;
    }
    /** Só vendas aprovadas (postback) — não somar eventos tracking conversion/sale (evita 2×). */
    for (const c of conversionRows) {
      const pid = c.presellId || "unattributed";
      if (!summaryMap[pid]) summaryMap[pid] = empty(pid);
      summaryMap[pid].conversions += c._count;
      const amt = c._sum.amount;
      if (amt != null) summaryMap[pid].revenue += Number(amt);
    }

    const result = Object.values(summaryMap).map((s) => ({
      ...s,
      ctr: s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0,
      conversion_rate: s.clicks > 0 ? (s.conversions / s.clicks) * 100 : 0,
    }));

    const byCampaignMap: Record<string, { campaign: string; conversions: number; revenue: number }> = {};
    const convByCampaign = await prisma.conversion.groupBy({
      by: ["campaign"],
      where: convWhere,
      _count: true,
      _sum: { amount: true },
    });
    for (const row of convByCampaign) {
      const campaign = row.campaign?.trim() || "(sem campanha)";
      byCampaignMap[campaign] = {
        campaign,
        conversions: row._count,
        revenue: row._sum.amount != null ? Number(row._sum.amount) : 0,
      };
    }

    // Compat: clientes antigos esperam array. Com ?detail=1 devolve objecto com by_campaign.
    if (req.query.detail === "1" || req.query.detail === "true") {
      return res.json({
        by_presell: result,
        by_campaign: Object.values(byCampaignMap),
      });
    }

    res.json(result);
  },

  async getEvents(req: Request, res: Response) {
    const { event_type, presell_id, limit, from, to, format, cursor, include_bots } = req.query;
    const userId = billingUserId(req);
    const formatStr = typeof format === "string" ? format.toLowerCase() : "";
    const wantCsv = formatStr === "csv" || formatStr === "text/csv";
    const includeBots =
      include_bots === "1" || include_bots === "true" || include_bots === "yes";

    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    if (from && typeof from === "string") {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0);
      if (!Number.isNaN(d.getTime())) rangeStart = d;
    }
    if (to && typeof to === "string") {
      const d = new Date(to);
      d.setHours(23, 59, 59, 999);
      if (!Number.isNaN(d.getTime())) rangeEnd = d;
    }
    const eventType = event_type && typeof event_type === "string" ? event_type : null;
    const presellId = presell_id && typeof presell_id === "string" ? presell_id : null;

    const baseWhere = Prisma.sql`
      WHERE user_id = ${userId}
        ${eventType ? Prisma.sql`AND event_type::text = ${eventType}` : Prisma.empty}
        ${presellId ? Prisma.sql`AND presell_page_id = ${presellId}` : Prisma.empty}
        ${rangeStart ? Prisma.sql`AND created_at >= ${rangeStart}` : Prisma.empty}
        ${rangeEnd ? Prisma.sql`AND created_at <= ${rangeEnd}` : Prisma.empty}
        ${sqlExcludeBotAndKpiNoise(includeBots)}
    `;

    if (wantCsv) {
      const decoded = typeof cursor === "string" ? decodeTimeIdCursor(cursor) : null;
      if (cursor && typeof cursor === "string" && !decoded) {
        return res.status(400).json({ error: "cursor inválido" });
      }

      const pageSize = Math.min(Math.max(Number(limit) || 10000, 1), 10000);
      const cursorSql =
        decoded != null
          ? Prisma.sql`AND (
              created_at < ${new Date(decoded.t)}
              OR (created_at = ${new Date(decoded.t)} AND id < ${decoded.id}::uuid)
            )`
          : Prisma.empty;

      const events = await systemPrisma.$queryRaw<TrackingEventListRow[]>(Prisma.sql`
        SELECT
          id,
          presell_page_id,
          event_type,
          source,
          medium,
          campaign,
          referrer,
          country,
          ip_address,
          device,
          created_at,
          metadata
        FROM tracking_events
        ${baseWhere}
        ${cursorSql}
        ORDER BY created_at DESC, id DESC
        LIMIT ${pageSize + 1}
      `);

      const hasMore = events.length > pageSize;
      const page = hasMore ? events.slice(0, pageSize) : events;
      const rows = page.map(mapDbTrackingEventRow);

      const last = page.length > 0 ? page[page.length - 1]! : null;
      const nextCursor = hasMore && last ? encodeTimeIdCursor(last.created_at, last.id) : null;

      const evLabel = eventType || "all";
      const fromS = from && typeof from === "string" ? from : "start";
      const toS = to && typeof to === "string" ? to : "end";
      const filename = `tracking-events_${evLabel}_${fromS}_${toS}.csv`;
      const headers = [
        "id",
        "presell_id",
        "event_type",
        "created_at",
        "country",
        "region",
        "city",
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
          (r as { region?: string | null }).region ?? "",
          (r as { city?: string | null }).city ?? "",
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
    const events = await systemPrisma.$queryRaw<TrackingEventListRow[]>(Prisma.sql`
      SELECT
        id,
        presell_page_id,
        event_type,
        source,
        medium,
        campaign,
        referrer,
        country,
        ip_address,
        device,
        created_at,
        metadata
      FROM tracking_events
      ${baseWhere}
      ORDER BY created_at DESC
      LIMIT ${take}
    `);
    res.json(events.map(mapDbTrackingEventRow));
  },

  /** Lista conversões aprovadas (postback) com dados do clique e sync Google Ads / Meta CAPI. */
  async listConversions(req: Request, res: Response) {
    const userId = billingUserId(req);
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
      "tiktok_events_sync",
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
        WHERE c.user_id = ${userId}
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
        r.tiktok_events_sync,
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
        r.tiktok_events_sync,
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
    const userId = billingUserId(req);
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
    const [aggRow, linkedRow, platformDistRow, chartRows, countryPerfRows, devicePerfRows, sourcePerfRows, keywordPerfRows] =
      await Promise.all([
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
          COUNT(*) FILTER (
            WHERE event_type::text = 'click'
              AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
              AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
          ) AS clicks,
          COUNT(*) FILTER (
            WHERE event_type::text = 'impression'
              AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
              AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
          ) AS impressions,
          COUNT(*) FILTER (
            WHERE event_type::text IN ('conversion', 'sale')
              AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
              AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
          ) AS tracking_conversions,
          COALESCE(
            SUM(
              CASE
                WHEN event_type::text IN ('conversion', 'sale')
                  AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
              AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
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
          AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
              AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `),
      systemPrisma.$queryRaw<
        Array<{ country: string; clicks: bigint; sales: bigint; revenue: unknown }>
      >(Prisma.sql`
        SELECT
          COALESCE(NULLIF(UPPER(TRIM(te.country)), ''), '(sem país)') AS country,
          COUNT(*)::bigint AS clicks,
          COUNT(c.id)::bigint AS sales,
          COALESCE(SUM(c.amount), 0) AS revenue
        FROM tracking_events te
        LEFT JOIN conversions c
          ON c.click_id = te.id
         AND c.user_id = te.user_id
         AND c.status = 'approved'
        WHERE te.user_id = ${userId}
          AND te.created_at >= ${rangeStart}
          AND te.created_at <= ${rangeEnd}
          AND te.event_type::text = 'click'
          AND NOT COALESCE((te.metadata->>'is_bot') = 'true', false)
          AND NOT COALESCE((te.metadata->>'exclude_from_kpi') = 'true', false)
        GROUP BY 1
        ORDER BY revenue DESC, sales DESC, clicks DESC
        LIMIT 50
      `),
      systemPrisma.$queryRaw<
        Array<{ device: string; clicks: bigint; sales: bigint; revenue: unknown }>
      >(Prisma.sql`
        SELECT
          COALESCE(NULLIF(LOWER(TRIM(te.device)), ''), '(desconhecido)') AS device,
          COUNT(*)::bigint AS clicks,
          COUNT(c.id)::bigint AS sales,
          COALESCE(SUM(c.amount), 0) AS revenue
        FROM tracking_events te
        LEFT JOIN conversions c
          ON c.click_id = te.id
         AND c.user_id = te.user_id
         AND c.status = 'approved'
        WHERE te.user_id = ${userId}
          AND te.created_at >= ${rangeStart}
          AND te.created_at <= ${rangeEnd}
          AND te.event_type::text = 'click'
          AND NOT COALESCE((te.metadata->>'is_bot') = 'true', false)
          AND NOT COALESCE((te.metadata->>'exclude_from_kpi') = 'true', false)
        GROUP BY 1
        ORDER BY revenue DESC, sales DESC, clicks DESC
        LIMIT 20
      `),
      systemPrisma.$queryRaw<
        Array<{ source: string; clicks: bigint; sales: bigint; revenue: unknown }>
      >(Prisma.sql`
        SELECT
          COALESCE(
            NULLIF(TRIM(te.metadata->>'utm_source'), ''),
            NULLIF(TRIM(te.source), ''),
            '(sem fonte)'
          ) AS source,
          COUNT(*)::bigint AS clicks,
          COUNT(c.id)::bigint AS sales,
          COALESCE(SUM(c.amount), 0) AS revenue
        FROM tracking_events te
        LEFT JOIN conversions c
          ON c.click_id = te.id
         AND c.user_id = te.user_id
         AND c.status = 'approved'
        WHERE te.user_id = ${userId}
          AND te.created_at >= ${rangeStart}
          AND te.created_at <= ${rangeEnd}
          AND te.event_type::text = 'click'
          AND NOT COALESCE((te.metadata->>'is_bot') = 'true', false)
          AND NOT COALESCE((te.metadata->>'exclude_from_kpi') = 'true', false)
        GROUP BY 1
        ORDER BY revenue DESC, sales DESC, clicks DESC
        LIMIT 40
      `),
      systemPrisma.$queryRaw<
        Array<{ keyword: string; clicks: bigint; sales: bigint; revenue: unknown }>
      >(Prisma.sql`
        SELECT
          COALESCE(
            NULLIF(
              CASE
                WHEN TRIM(COALESCE(te.metadata->>'utm_term', '')) ~ '^\{[a-zA-Z0-9_.]+\}$' THEN NULL
                WHEN TRIM(COALESCE(te.metadata->>'utm_term', '')) ~ '^\{\{[a-zA-Z0-9_.]+\}\}$' THEN NULL
                WHEN TRIM(COALESCE(te.metadata->>'utm_term', '')) ~* '^%7B[a-zA-Z0-9_.]+%7D$' THEN NULL
                ELSE TRIM(te.metadata->>'utm_term')
              END,
              ''
            ),
            '(sem keyword)'
          ) AS keyword,
          COUNT(*)::bigint AS clicks,
          COUNT(c.id)::bigint AS sales,
          COALESCE(SUM(c.amount), 0) AS revenue
        FROM tracking_events te
        LEFT JOIN conversions c
          ON c.click_id = te.id
         AND c.user_id = te.user_id
         AND c.status = 'approved'
        WHERE te.user_id = ${userId}
          AND te.created_at >= ${rangeStart}
          AND te.created_at <= ${rangeEnd}
          AND te.event_type::text = 'click'
          AND NOT COALESCE((te.metadata->>'is_bot') = 'true', false)
          AND NOT COALESCE((te.metadata->>'exclude_from_kpi') = 'true', false)
        GROUP BY 1
        ORDER BY revenue DESC, sales DESC, clicks DESC
        LIMIT 40
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
      tiktokEventsEnabled: boolean;
      tiktokPixelId: string | null;
      tiktokEventsAccessToken: string | null;
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
          tiktokEventsEnabled: true,
          tiktokPixelId: true,
          tiktokEventsAccessToken: true,
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
    /** Fonte canónica de vendas/receita: postbacks aprovados (tabela conversions) — sem somar eventos tracking (evita 2×). */
    const linkedConvCount = Number(l?.cnt ?? 0);
    const revenueLinked = l?.revenue_sum != null ? Number(l.revenue_sum) : 0;
    const revenue = revenueLinked;
    const affiliatePlatformsCount = Number(platformDistRow[0]?.cnt ?? 0);
    const conversions = linkedConvCount;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const conversion_rate = clicks > 0 ? (conversions / clicks) * 100 : 0;

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
    const tiktokEventsLive = pipelineUser ? isTikTokEventsReadyForUser(pipelineUser) : false;

    let google_ads_metrics: {
      impressions: number;
      clicks: number;
      conversions: number;
      cost_micros: number;
      currency_code: string | null;
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

    const country_performance = countryPerfRows.map((row) => {
      const clicksD = Number(row.clicks);
      const salesD = Number(row.sales);
      const revD = Number(row.revenue ?? 0);
      return {
        country: row.country,
        clicks: clicksD,
        sales: salesD,
        revenue: Math.round(revD * 100) / 100,
        epc: clicksD > 0 ? Math.round((revD / clicksD) * 10000) / 10000 : null,
        cvr: clicksD > 0 ? Math.round((salesD / clicksD) * 10000) / 100 : null,
      };
    });

    const device_performance = devicePerfRows.map((row) => {
      const clicksD = Number(row.clicks);
      const salesD = Number(row.sales);
      const revD = Number(row.revenue ?? 0);
      return {
        device: row.device,
        clicks: clicksD,
        sales: salesD,
        revenue: Math.round(revD * 100) / 100,
        epc: clicksD > 0 ? Math.round((revD / clicksD) * 10000) / 10000 : null,
        cvr: clicksD > 0 ? Math.round((salesD / clicksD) * 10000) / 100 : null,
      };
    });

    const source_performance = sourcePerfRows.map((row) => {
      const clicksD = Number(row.clicks);
      const salesD = Number(row.sales);
      const revD = Number(row.revenue ?? 0);
      return {
        source: row.source,
        clicks: clicksD,
        sales: salesD,
        revenue: Math.round(revD * 100) / 100,
        epc: clicksD > 0 ? Math.round((revD / clicksD) * 10000) / 10000 : null,
        cvr: clicksD > 0 ? Math.round((salesD / clicksD) * 10000) / 100 : null,
      };
    });

    /** Compat: mapa simples de cliques por país (UI antiga / Home). */
    const clicks_by_country = country_performance.map((row) => {
      const raw = row.country?.trim();
      if (!raw || raw === "(sem país)") return { country_code: null as string | null, clicks: row.clicks };
      const u = raw.toUpperCase();
      const country_code = u.length === 2 && /^[A-Z]{2}$/.test(u) ? u : null;
      return { country_code, clicks: row.clicks };
    });

    const keyword_performance = keywordPerfRows.map((row) => {
      const clicksKw = Number(row.clicks);
      const salesKw = Number(row.sales);
      const revKw = Number(row.revenue ?? 0);
      return {
        keyword: row.keyword,
        clicks: clicksKw,
        sales: salesKw,
        revenue: Math.round(revKw * 100) / 100,
        cost: null as number | null,
        profit: null as number | null,
        roas: null as number | null,
        epc: clicksKw > 0 ? Math.round((revKw / clicksKw) * 10000) / 10000 : null,
        cvr: clicksKw > 0 ? Math.round((salesKw / clicksKw) * 10000) / 100 : null,
      };
    });

    /** Junta custo: preferir tabela diária persistida; fallback GAQL live. */
    try {
      const persistedKw = await sumPersistedKeywordCosts({
        userId,
        from: rangeStart,
        to: rangeEnd,
      });
      if (persistedKw.size > 0) {
        for (const row of keyword_performance) {
          if (row.keyword === "(sem keyword)") continue;
          const cost = persistedKw.get(row.keyword.trim().toLowerCase());
          if (cost == null) continue;
          row.cost = Math.round(cost * 100) / 100;
          row.profit = Math.round((row.revenue - cost) * 100) / 100;
          row.roas = cost > 0 ? Math.round((row.revenue / cost) * 100) / 100 : null;
        }
        keyword_performance.sort((a, b) => (b.profit ?? b.revenue) - (a.profit ?? a.revenue));
      } else if (pipelineUser && isGoogleAdsMetricsReadyForUser(pipelineUser)) {
        const kwG = await fetchGoogleAdsKeywordInsights({
          user: pipelineUser,
          from: rangeStart,
          to: rangeEnd,
        });
        if (kwG.ok && kwG.rows.length) {
          const costByKw = new Map<string, number>();
          for (const r of kwG.rows) {
            const key = (r.keyword || "").trim().toLowerCase();
            if (!key || key === "—") continue;
            const euros = (Number(r.cost_micros) || 0) / 1_000_000;
            costByKw.set(key, (costByKw.get(key) || 0) + euros);
          }
          for (const row of keyword_performance) {
            if (row.keyword === "(sem keyword)") continue;
            const cost = costByKw.get(row.keyword.trim().toLowerCase());
            if (cost == null) continue;
            row.cost = Math.round(cost * 100) / 100;
            row.profit = Math.round((row.revenue - cost) * 100) / 100;
            row.roas = cost > 0 ? Math.round((row.revenue / cost) * 100) / 100 : null;
          }
          keyword_performance.sort((a, b) => (b.profit ?? b.revenue) - (a.profit ?? a.revenue));
        }
      }
    } catch (e) {
      console.warn("[analytics.getDashboard] keyword cost join falhou", e);
    }

    /** P&L por ad group (utm_content ≈ nome do grupo / custo Google ad_group). */
    let ad_group_performance: Array<{
      ad_group: string;
      clicks: number;
      sales: number;
      revenue: number;
      cost: number | null;
      profit: number | null;
      roas: number | null;
    }> = [];
    try {
      const agRows = await systemPrisma.$queryRaw<
        Array<{ ad_group: string; clicks: bigint; sales: bigint; revenue: unknown }>
      >(Prisma.sql`
        SELECT
          COALESCE(
            NULLIF(
              CASE
                WHEN TRIM(COALESCE(te.metadata->>'utm_content', '')) ~ '^\{[a-zA-Z0-9_.]+\}$' THEN NULL
                WHEN TRIM(COALESCE(te.metadata->>'utm_content', '')) ~ '^\{\{[a-zA-Z0-9_.]+\}\}$' THEN NULL
                WHEN TRIM(COALESCE(te.metadata->>'utm_content', '')) ~* '^%7B[a-zA-Z0-9_.]+%7D$' THEN NULL
                ELSE TRIM(te.metadata->>'utm_content')
              END,
              ''
            ),
            '(sem ad group)'
          ) AS ad_group,
          COUNT(*)::bigint AS clicks,
          COUNT(c.id)::bigint AS sales,
          COALESCE(SUM(c.amount), 0) AS revenue
        FROM tracking_events te
        LEFT JOIN conversions c
          ON c.click_id = te.id
         AND c.user_id = te.user_id
         AND c.status = 'approved'
        WHERE te.user_id = ${userId}
          AND te.created_at >= ${rangeStart}
          AND te.created_at <= ${rangeEnd}
          AND te.event_type::text = 'click'
          AND NOT COALESCE((te.metadata->>'is_bot') = 'true', false)
          AND NOT COALESCE((te.metadata->>'exclude_from_kpi') = 'true', false)
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 40
      `);
      const costAg = await sumPersistedAdGroupCosts({
        userId,
        from: rangeStart,
        to: rangeEnd,
      });
      ad_group_performance = agRows.map((row) => {
        const clicksAg = Number(row.clicks);
        const salesAg = Number(row.sales);
        const revAg = Number(row.revenue ?? 0);
        const cost =
          row.ad_group === "(sem ad group)"
            ? null
            : costAg.get(row.ad_group.trim().toLowerCase()) ?? null;
        const costR = cost != null ? Math.round(cost * 100) / 100 : null;
        return {
          ad_group: row.ad_group,
          clicks: clicksAg,
          sales: salesAg,
          revenue: Math.round(revAg * 100) / 100,
          cost: costR,
          profit: costR != null ? Math.round((revAg - costR) * 100) / 100 : null,
          roas: costR != null && costR > 0 ? Math.round((revAg / costR) * 100) / 100 : null,
        };
      });
    } catch (e) {
      console.warn("[analytics.getDashboard] ad_group_performance", e);
    }

    /** Quota de cliques do plano (mês civil UTC) — barra real nos Relatórios. Soft-cap: track nunca bloqueia. */
    let click_quota: {
      used: number;
      max: number | null;
      percent: number | null;
      over_limit: boolean;
      soft_cap: boolean;
    } = { used: 0, max: null, percent: null, over_limit: false, soft_cap: true };
    try {
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);
      const [usedRow, sub] = await Promise.all([
        systemPrisma.$queryRaw<Array<{ cnt: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS cnt
          FROM tracking_events
          WHERE user_id = ${userId}
            AND event_type::text = 'click'
            AND created_at >= ${startOfMonth}
            AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
              AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
        `),
        systemPrisma.subscription.findUnique({
          where: { userId },
          include: { plan: { select: { maxClicksPerMonth: true } } },
        }),
      ]);
      const used = Number(usedRow[0]?.cnt ?? 0);
      const max = sub?.plan?.maxClicksPerMonth ?? null;
      const over = max != null && max > 0 && used >= max;
      click_quota = {
        used,
        max,
        percent: max != null && max > 0 ? Math.min(100, Math.round((used / max) * 1000) / 10) : null,
        over_limit: over,
        soft_cap: true,
      };
    } catch (e) {
      console.warn("[analytics.getDashboard] click_quota indisponível", e);
    }

    /** Observabilidade: conversões com envio Google/Meta falhado nos últimos 7 dias (UTC). */
    const syncHealthStart = new Date();
    syncHealthStart.setUTCDate(syncHealthStart.getUTCDate() - 7);
    syncHealthStart.setUTCHours(0, 0, 0, 0);
    let sync_health: {
      period_days: number;
      google_ads_failed: number;
      meta_capi_failed: number;
      tiktok_events_failed: number;
    } = { period_days: 7, google_ads_failed: 0, meta_capi_failed: 0, tiktok_events_failed: 0 };
    try {
      const [sh] = await systemPrisma.$queryRaw<
        Array<{ g: bigint | null; m: bigint | null; t: bigint | null }>
      >(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE google_ads_sync = 'failed')::bigint AS g,
          COUNT(*) FILTER (WHERE meta_capi_sync = 'failed')::bigint AS m,
          COUNT(*) FILTER (WHERE tiktok_events_sync = 'failed')::bigint AS t
        FROM conversions
        WHERE user_id = ${userId}
          AND status = 'approved'
          AND created_at >= ${syncHealthStart}
      `);
      sync_health = {
        period_days: 7,
        google_ads_failed: Number(sh?.g ?? 0),
        meta_capi_failed: Number(sh?.m ?? 0),
        tiktok_events_failed: Number(sh?.t ?? 0),
      };
    } catch (e) {
      console.warn("[analytics.getDashboard] sync_health indisponível (colunas ou BD)", e);
    }

    /** Media buyer: lucro = receita − gasto. Preferir custo Google do período; senão soma de gastos manuais. */
    let manualSpendTotal = 0;
    try {
      const spendAgg = await systemPrisma.$queryRaw<Array<{ total: unknown }>>(Prisma.sql`
        SELECT COALESCE(SUM(spend_amount), 0) AS total
        FROM affiliate_campaigns
        WHERE user_id = ${userId}
          AND spend_amount IS NOT NULL
      `);
      manualSpendTotal = Number(spendAgg[0]?.total ?? 0);
    } catch (e) {
      console.warn("[analytics.getDashboard] spend_amount indisponível (migração?)", e);
    }

    const googleSpendLive =
      google_ads_metrics != null && Number.isFinite(google_ads_metrics.cost_micros)
        ? google_ads_metrics.cost_micros / 1_000_000
        : null;

    let persisted = { total: 0, by_platform: {} as Record<string, number> };
    try {
      persisted = await sumPersistedSpend({ userId, from: rangeStart, to: rangeEnd });
    } catch (e) {
      console.warn("[analytics.getDashboard] persisted spend", e);
    }

    let spend: number | null = null;
    let spend_source: "persisted" | "google_ads" | "manual" | "none" = "none";
    let spend_currency: string | null = null;
    let spend_by_platform: Record<string, number> | null = null;
    /** Gasto manual na campanha é lifetime — não misturar com receita do período (mentiria ROAS/CPA). */
    let manual_spend_lifetime: number | null = null;
    if (persisted.total > 0) {
      spend = persisted.total;
      spend_source = "persisted";
      spend_by_platform = persisted.by_platform;
      spend_currency = google_ads_metrics?.currency_code ?? "USD";
    } else if (googleSpendLive != null && googleSpendLive > 0) {
      spend = Math.round(googleSpendLive * 100) / 100;
      spend_source = "google_ads";
      spend_currency = google_ads_metrics?.currency_code ?? "EUR";
      spend_by_platform = { google_ads: spend };
    } else if (manualSpendTotal > 0) {
      manual_spend_lifetime = Math.round(manualSpendTotal * 100) / 100;
      spend_source = "manual";
      spend_currency = "EUR";
    }

    const mb = computePerf({
      clicks,
      conversions,
      revenue,
      spend,
    });
    const mediaBuyerAlerts = buildMediaBuyerAlerts({
      clicks,
      conversions,
      revenue,
      spend,
      spendSource: spend_source,
      googleError: google_ads_metrics_error,
    });
    if (spend_source === "manual" && manual_spend_lifetime != null) {
      mediaBuyerAlerts.unshift({
        code: "manual_spend_lifetime",
        severity: "warning",
        title: "Gasto manual fora do período",
        detail: `Há ${manual_spend_lifetime.toFixed(2)} ${spend_currency ?? "EUR"} indicados nas campanhas (total acumulado). Lucro/ROAS/CPA do período só usam gasto Google Ads do mesmo intervalo — actualize o gasto por campanha alinhado às datas ou ligue o Google Ads.`,
      });
    }
    let account_health: Awaited<ReturnType<typeof buildAccountHealth>> | null = null;
    try {
      const [macroRow] = await systemPrisma.$queryRaw<Array<{ ct: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS ct
        FROM tracking_events
        WHERE user_id = ${userId}
          AND created_at >= ${rangeStart}
          AND created_at <= ${rangeEnd}
          AND event_type::text = 'click'
          AND NOT COALESCE((metadata->>'is_bot') = 'true', false)
              AND NOT COALESCE((metadata->>'exclude_from_kpi') = 'true', false)
          AND (
            TRIM(COALESCE(metadata->>'utm_term', '')) ~ '^\{[a-zA-Z0-9_.]+\}$'
            OR TRIM(COALESCE(metadata->>'utm_content', '')) ~ '^\{[a-zA-Z0-9_.]+\}$'
            OR TRIM(COALESCE(metadata->>'utm_term', '')) ~* '^%7B[a-zA-Z0-9_.]+%7D$'
            OR TRIM(COALESCE(metadata->>'utm_content', '')) ~* '^%7B[a-zA-Z0-9_.]+%7D$'
          )
      `);
      const macroClicks = Number(macroRow?.ct ?? 0);
      if (macroClicks > 0) {
        mediaBuyerAlerts.unshift({
          code: "unreplaced_ad_macros",
          severity: "warning",
          title: "Macros Google não substituídas",
          detail: `${macroClicks} clique(s) chegaram com {keyword}/{creative} literal. As macros só expandem quando o visitante clica no anúncio no Google Ads — testes manuais do link e URLs com %7Bkeyword%7D não contam como keyword real. Nos relatórios esses cliques passam a «(sem keyword)».`,
        });
      }

      const [softPassRow] = await systemPrisma.$queryRaw<Array<{ ct: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS ct
        FROM tracking_events
        WHERE user_id = ${userId}
          AND created_at >= ${rangeStart}
          AND created_at <= ${rangeEnd}
          AND event_type::text = 'click'
          AND COALESCE((metadata->>'guard_soft_pass') = 'true', false)
      `);
      const softPassClicks = Number(softPassRow?.ct ?? 0);
      if (softPassClicks > 0) {
        mediaBuyerAlerts.unshift({
          code: "guard_soft_pass",
          severity: "info",
          title: "Protecções em soft-pass",
          detail: `${softPassClicks} clique(s) passaram o redirect com soft-pass (proxy/rate/whitelist). O visitante foi à oferta; parte pode estar excluída do KPI. Bots/blacklist redireccionam sem criar clique — vê IP e protecções se o volume parecer estranho.`,
        });
      }

      account_health = await buildAccountHealth({
        userId,
        rangeStart,
        rangeEnd,
        pipelineUser,
        macroClicksInPeriod: macroClicks,
      });
      if (account_health.attribution.unattributed_sales > 0) {
        mediaBuyerAlerts.unshift({
          code: "unattributed_sales",
          severity: "warning",
          title: "Vendas sem atribuição",
          detail: `${account_health.attribution.unattributed_sales} venda(s) aprovada(s) sem click ID — aparecem na receita mas não em keyword/campanha. Confirme subid/cid/sub3 no hoplink.`,
        });
      }
    } catch (e) {
      console.warn("[analytics.getDashboard] macro/health", e);
    }

    let compare:
      | {
          period: { from: string; to: string };
          clicks: number;
          conversions: number;
          revenue: number;
          delta: { clicks_pct: number | null; conversions_pct: number | null; revenue_pct: number | null };
        }
      | null = null;
    const compareFromQ = req.query.compare_from?.toString();
    const compareToQ = req.query.compare_to?.toString();
    if (compareFromQ && compareToQ) {
      try {
        const cStart = new Date(compareFromQ);
        cStart.setHours(0, 0, 0, 0);
        const cEnd = new Date(compareToQ);
        cEnd.setHours(23, 59, 59, 999);
        if (!Number.isNaN(cStart.getTime()) && !Number.isNaN(cEnd.getTime()) && cStart <= cEnd) {
          const snap = await loadPeriodSnapshot({ userId, rangeStart: cStart, rangeEnd: cEnd });
          const pct = (cur: number, prev: number) =>
            prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? 100 : null;
          compare = {
            period: { from: compareFromQ, to: compareToQ },
            ...snap,
            delta: {
              clicks_pct: pct(clicks, snap.clicks),
              conversions_pct: pct(conversions, snap.conversions),
              revenue_pct: pct(revenue, snap.revenue),
            },
          };
        }
      } catch (e) {
        console.warn("[analytics.getDashboard] compare", e);
      }
    }

    const media_buyer = {
      spend,
      spend_source,
      spend_currency,
      spend_by_platform,
      manual_spend_lifetime,
      revenue: mb.revenue,
      profit: mb.profit,
      /** Lucro/ROAS só com gasto sincronizado do período — nunca gasto manual lifetime. */
      profit_uses_period_spend: spend_source === "persisted" || spend_source === "google_ads",
      roas: mb.roas,
      cpa: mb.cpa,
      epc: mb.epc,
      conversion_rate: mb.conversion_rate,
      alerts: mediaBuyerAlerts,
    };

    res.json({
      total_clicks: clicks,
      total_impressions: impressions,
      /** Alias histórico: igual a vendas aprovadas (postback). */
      total_conversions: conversions,
      ctr: Math.round(ctr * 100) / 100,
      conversion_rate: Math.round(conversion_rate * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      /** Vendas aprovadas (postbacks / tabela conversions) — fonte de verdade. */
      approved_sales_count: linkedConvCount,
      /** Eventos conversion/sale no script (não somados às vendas — só telemetria). */
      tracking_conversion_events: trackingConversions,
      tracking_conversion_revenue: Math.round(revenueTracking * 100) / 100,
      /** Plataformas de afiliado distintas (metadata.platform) com pelo menos uma venda no período. */
      affiliate_platforms_count: affiliatePlatformsCount,
      chart_data,
      period: {
        from: rangeStart.toISOString().split("T")[0],
        to: rangeEnd.toISOString().split("T")[0],
        timezone: "UTC",
      },
      compare,
      account_health,
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
        tiktok_events_integration: tiktokEventsLive,
      },
      google_ads_metrics,
      google_ads_metrics_error,
      clicks_by_country,
      country_performance,
      device_performance,
      source_performance,
      keyword_performance,
      ad_group_performance,
      click_quota,
      sync_health,
      media_buyer,
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
    const userId = billingUserId(req);
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
    const userId = billingUserId(req);
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
        const meta = (c.click?.metadata || {}) as Record<string, unknown>;
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
          const meta = (c.click?.metadata || {}) as Record<string, unknown>;
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

  /** Detalhe de um evento de clique (lookup estilo ferramentas de tracking). */
  async getTrackingClick(req: Request, res: Response) {
    const userId = billingUserId(req);
    const eventId = req.params.eventId?.trim();
    if (!eventId) return res.status(400).json({ error: "ID em falta." });

    const ev = await prisma.trackingEvent.findFirst({
      where: { id: eventId, userId, eventType: "click" },
      select: {
        id: true,
        createdAt: true,
        presellPageId: true,
        source: true,
        medium: true,
        campaign: true,
        referrer: true,
        country: true,
        device: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
      },
    });
    if (!ev) return res.status(404).json({ error: "Clique não encontrado." });

    const meta = (ev.metadata || {}) as Record<string, unknown>;
    res.json({
      id: ev.id,
      created_at: ev.createdAt.toISOString(),
      presell_id: ev.presellPageId,
      source: ev.source,
      medium: ev.medium,
      campaign: ev.campaign,
      referrer: ev.referrer,
      country: ev.country,
      device: ev.device,
      ip: ev.ipAddress,
      user_agent: ev.userAgent,
      metadata: meta,
      rotator_id: typeof meta.rotator_id === "string" ? meta.rotator_id : null,
      rotator_arm_id: typeof meta.rotator_arm_id === "string" ? meta.rotator_arm_id : null,
      sub_ids:
        typeof meta.sub1 === "string" || typeof meta.sub2 === "string" || typeof meta.sub3 === "string"
          ? { sub1: meta.sub1, sub2: meta.sub2, sub3: meta.sub3 }
          : null,
      sub_path: typeof meta.sub_path === "string" ? meta.sub_path : null,
      path_segments: Array.isArray(meta.path_segments)
        ? meta.path_segments.filter((x): x is string => typeof x === "string")
        : null,
      redirect_to: typeof meta.redirect_to === "string" ? meta.redirect_to : null,
    });
  },

  /** Tentativas bloqueadas: blacklist ou regras de tracking (rate limit, whitelist, UA, bots). */
  async getBlacklistBlocks(req: Request, res: Response) {
    const userId = billingUserId(req);
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
