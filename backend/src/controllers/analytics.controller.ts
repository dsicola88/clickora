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
import { countryIsoFromIp } from "../lib/countryFromIp";

type AnalyticsSummaryItem = {
  presell_id: string;
  clicks: number;
  impressions: number;
  ctr: number;
  conversions: number;
  revenue: number;
};

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
    const { event_type, presell_id, limit, from, to } = req.query;
    const userId = req.user!.userId;

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

    const take = Math.min(Number(limit) || 200, 500);

    const events = await prisma.trackingEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
    });

    res.json(
      events.map((e) => {
        const metadata = (e.metadata || {}) as Record<string, unknown>;
        const gclid = typeof metadata.gclid === "string" ? metadata.gclid : null;
        const msclkid = typeof metadata.msclkid === "string" ? metadata.msclkid : null;
        const paid = Boolean(gclid?.trim() || msclkid?.trim());
        const storedCountry = e.country && String(e.country).trim() ? String(e.country).trim().toUpperCase() : null;
        const country = storedCountry ?? countryIsoFromIp(e.ipAddress ?? null);
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
          gclid,
          msclkid,
          traffic_type: paid ? "paid" : "organic",
          is_bot: metadata.is_bot === true,
          bot_label: typeof metadata.bot_label === "string" ? metadata.bot_label : null,
        };
      }),
    );
  },

  /** Lista conversões aprovadas (postback) com dados do clique e sync Google Ads. */
  async listConversions(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { from, to, missing_gclid, limit } = req.query;

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

    const wantMissingGclid = missing_gclid === "1" || missing_gclid === "true";
    const take = Math.min(Number(limit) || (wantMissingGclid ? 2000 : 200), wantMissingGclid ? 3000 : 500);

    const rows = await prisma.conversion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        click: { select: { id: true, metadata: true } },
      },
    });

    const out = rows.map((c) => {
      const meta = (c.metadata || {}) as Record<string, unknown>;
      const clickMeta = (c.click.metadata || {}) as Record<string, unknown>;
      const gclid = typeof clickMeta.gclid === "string" ? clickMeta.gclid : null;
      const wbraid = typeof clickMeta.wbraid === "string" ? clickMeta.wbraid : null;
      const gbraid = typeof clickMeta.gbraid === "string" ? clickMeta.gbraid : null;
      const hasClickId = Boolean(gclid?.trim() || gbraid?.trim() || wbraid?.trim());
      const platform = typeof meta.platform === "string" ? meta.platform : "—";
      const keyword =
        (typeof clickMeta.utm_term === "string" && clickMeta.utm_term) ||
        (typeof c.campaign === "string" && c.campaign) ||
        "—";
      const amount = c.amount != null ? Number(c.amount) : null;
      return {
        id: c.id,
        created_at: c.createdAt.toISOString(),
        click_id: c.clickId,
        presell_id: c.presellId,
        keyword,
        commission: amount != null && Number.isFinite(amount) ? amount : null,
        currency: c.currency ?? "USD",
        platform,
        google_ads_sync: c.googleAdsSync,
        has_gclid: hasClickId,
        gclid: gclid || null,
      };
    });

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

    /** Colunas Google Ads em `users` podem faltar na BD (P2022) — não pode derrubar o dashboard inteiro. */
    type PipelineUser = {
      googleAdsEnabled: boolean;
      googleAdsCustomerId: string | null;
      googleAdsConversionActionId: string | null;
      googleAdsLoginCustomerId: string | null;
      googleAdsRefreshToken: string | null;
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
      },
      google_ads_metrics,
      google_ads_metrics_error,
      clicks_by_country,
    });
    } catch (e) {
      console.error("[analytics.getDashboard]", e);
      return res.status(503).json({
        error: "Indisponível de momento. Tente novamente.",
        code: "dashboard_unavailable",
      });
    }
  },

  /** Tentativas de clique/impressão bloqueadas por IP na blacklist (registo em postback_logs). */
  async getBlacklistBlocks(req: Request, res: Response) {
    const userId = req.user!.userId;
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const logs = await prisma.postbackLog.findMany({
      where: { userId, platform: "blacklist_block" },
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
        };
      }),
    );
  },
};
