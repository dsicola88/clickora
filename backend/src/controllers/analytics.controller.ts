import { Request, Response } from "express";
import type { EventType, Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { createPostbackToken } from "../lib/postbackToken";
import { publicApiBaseFromRequest } from "../lib/publicApiBase";
import {
  getGoogleAdsApiClientConfigFromEnv,
  isGoogleAdsClickUploadReadyForUser,
} from "../modules/googleAds/googleAds.service";

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
    const { event_type, presell_id, limit } = req.query;
    const userId = req.user!.userId;

    const where: Prisma.TrackingEventWhereInput = { userId };
    if (event_type && typeof event_type === "string") where.eventType = event_type as EventType;
    if (presell_id && typeof presell_id === "string") where.presellPageId = presell_id;

    const events = await prisma.trackingEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Number(limit) || 50,
    });

    res.json(
      events.map((e) => {
        const metadata = (e.metadata || {}) as Record<string, unknown>;
        return {
          id: e.id,
          presell_id: e.presellPageId,
          event_type: e.eventType,
          source: e.source,
          medium: e.medium,
          campaign: e.campaign,
          referrer: e.referrer,
          country: e.country,
          device: e.device,
          created_at: e.createdAt.toISOString(),
          metadata: e.metadata ?? {},
          utm_source: typeof metadata.utm_source === "string" ? metadata.utm_source : (e.source ?? null),
        };
      }),
    );
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
      rangeStart.setDate(rangeStart.getDate() - 30);
      rangeStart.setHours(0, 0, 0, 0);
    }

    const createdAt = { gte: rangeStart, lte: rangeEnd };

    const [clicks, impressions, trackingConversions, conversionEvents, linkedConvCount, linkedRevenueAgg, recentEvents] =
      await Promise.all([
        prisma.trackingEvent.count({ where: { userId, eventType: "click", createdAt } }),
        prisma.trackingEvent.count({ where: { userId, eventType: "impression", createdAt } }),
        prisma.trackingEvent.count({ where: { userId, eventType: { in: ["conversion", "sale"] }, createdAt } }),
        prisma.trackingEvent.findMany({
          where: { userId, eventType: { in: ["conversion", "sale"] }, createdAt },
          select: { metadata: true },
        }),
        prisma.conversion.count({ where: { userId, status: "approved", createdAt } }),
        prisma.conversion.aggregate({
          where: { userId, status: "approved", createdAt },
          _sum: { amount: true },
        }),
        prisma.trackingEvent.findMany({
          where: { userId, createdAt },
          select: { eventType: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);
    const revenueTracking = conversionEvents.reduce((sum, e) => {
      const metadata = (e.metadata || {}) as Record<string, unknown>;
      const value = Number(metadata.value);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    const revenueLinked = linkedRevenueAgg._sum.amount != null ? Number(linkedRevenueAgg._sum.amount) : 0;
    const revenue = revenueTracking + revenueLinked;
    const conversions = trackingConversions + linkedConvCount;

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    const chartMap: Record<string, { clicks: number; impressions: number }> = {};
    for (const e of recentEvents) {
      const date = e.createdAt.toISOString().split("T")[0];
      if (!chartMap[date]) chartMap[date] = { clicks: 0, impressions: 0 };
      if (e.eventType === "click") chartMap[date].clicks++;
      if (e.eventType === "impression") chartMap[date].impressions++;
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

    const pipelineUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleAdsEnabled: true,
        googleAdsCustomerId: true,
        googleAdsConversionActionId: true,
        googleAdsLoginCustomerId: true,
        googleAdsRefreshToken: true,
      },
    });
    const googleAdsLive = pipelineUser ? isGoogleAdsClickUploadReadyForUser(pipelineUser) : false;

    res.json({
      total_clicks: clicks,
      total_impressions: impressions,
      total_conversions: conversions,
      ctr: Math.round(ctr * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
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
      },
    });
  },
};
