/**
 * Sincroniza estado local de campanhas com IDs remotos (Google, Meta, TikTok).
 * Uso: após pausar na rede ou fora do Clickora, corre manualmente o endpoint POST /reconcile.
 */
import type { PaidAdsCampaignStatus } from "@prisma/client";

import { paidLog } from "../lib/paidLog";
import { getAccessFromRefreshToken, getGoogleDeveloperToken, runGoogleAdsSearch } from "./google-ads.api";
import { prisma } from "./paidPrisma";
import { tiktokApiPostWithTokenRetry } from "./tiktok-oauth.api";

const GRAPH = "https://graph.facebook.com/v21.0";
const LOGIN = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "") || undefined;

export type ReconcileEntry = {
  campaign_id: string;
  platform: string;
  before: PaidAdsCampaignStatus;
  after: PaidAdsCampaignStatus;
  remote: string;
};

export type ReconcileError = { campaign_id: string; platform: string; error: string };

function mapGoogleStatus(s: string | undefined): PaidAdsCampaignStatus | null {
  const u = (s ?? "").toUpperCase();
  if (u === "ENABLED" || u === "UNKNOWN" /* legacy */) return "live";
  if (u === "PAUSED" || u === "SUSPENDED") return "paused";
  if (u === "REMOVED" || u === "DELETED") return "archived";
  return null;
}

function mapMetaStatus(s: string | undefined): PaidAdsCampaignStatus | null {
  const u = (s ?? "").toUpperCase();
  if (u === "ACTIVE" || u === "PENDING_REVIEW" || u === "IN_PROCESS") return "live";
  if (u === "PAUSED" || u === "WITH_ISSUES" || u === "DISAPPROVED" || u === "PENDING_BILLING_INFO") {
    return "paused";
  }
  if (u === "DELETED" || u === "ARCHIVED") return "archived";
  return null;
}

function mapTikTokStatus(op: string | undefined): PaidAdsCampaignStatus | null {
  const u = (op ?? "").toUpperCase();
  if (u === "ENABLE" || u === "ACTIVE") return "live";
  if (u === "DISABLE" || u === "PAUSE") return "paused";
  if (u === "DELETE" || u === "DELETED" || u === "REMOVE") return "archived";
  return null;
}

export async function reconcileProjectCampaigns(projectId: string): Promise<{
  ok: true;
  updated: ReconcileEntry[];
  errors: ReconcileError[];
  skipped: { campaign_id: string; reason: string }[];
}> {
  const updated: ReconcileEntry[] = [];
  const errors: ReconcileError[] = [];
  const skipped: { campaign_id: string; reason: string }[] = [];

  const rows = await prisma.paidAdsCampaign.findMany({
    where: { projectId, externalCampaignId: { not: null } },
    select: { id: true, platform: true, status: true, externalCampaignId: true },
  });

  const googleCtx = (async () => {
    const conn = await prisma.paidAdsGoogleAdsConnection.findUnique({ where: { projectId } });
    if (!conn?.tokenRef || !conn.googleCustomerId) return { ok: false as const, err: "Google não ligado." };
    const dev = getGoogleDeveloperToken();
    if (!dev) return { ok: false as const, err: "GOOGLE_ADS_DEVELOPER_TOKEN em falta." };
    let access: string;
    try {
      ({ access_token: access } = await getAccessFromRefreshToken(conn.tokenRef));
    } catch (e) {
      return { ok: false as const, err: e instanceof Error ? e.message : "Token Google inválido." };
    }
    return { ok: true as const, access, customerId: conn.googleCustomerId.replace(/\D/g, ""), dev };
  })();

  const metaToken = (async () => {
    const conn = await prisma.paidAdsMetaConnection.findUnique({ where: { projectId } });
    if (!conn?.tokenRef || conn.tokenRef.startsWith("state:") || !conn.adAccountId) {
      return { ok: false as const, err: "Meta não ligado." };
    }
    return { ok: true as const, token: conn.tokenRef };
  })();

  const g = await googleCtx;
  const m = await metaToken;

  for (const row of rows) {
    const extId = row.externalCampaignId;
    if (extId == null || extId === "") {
      skipped.push({ campaign_id: row.id, reason: "sem externalCampaignId" });
      continue;
    }
    if (row.platform === "google_ads") {
      if (!g.ok) {
        errors.push({ campaign_id: row.id, platform: "google_ads", error: g.err });
        continue;
      }
      const ext = extId.replace(/\D/g, "");
      const q = `SELECT campaign.id, campaign.status FROM campaign WHERE campaign.id = ${ext}`;
      const s = await runGoogleAdsSearch(g.access, g.customerId, g.dev, q, LOGIN);
      if (s.error) {
        errors.push({
          campaign_id: row.id,
          platform: "google_ads",
          error: s.error.message ?? "search",
        });
        continue;
      }
      const r0 = s.results?.[0] as { campaign?: { status?: string } } | undefined;
      const st = r0?.campaign?.status;
      const mapped = mapGoogleStatus(st);
      if (mapped == null) {
        skipped.push({ campaign_id: row.id, reason: `Google status desconhecido: ${String(st)}` });
        continue;
      }
      if (mapped !== row.status) {
        await prisma.paidAdsCampaign.update({ where: { id: row.id }, data: { status: mapped } });
        updated.push({
          campaign_id: row.id,
          platform: "google_ads",
          before: row.status,
          after: mapped,
          remote: String(st),
        });
        paidLog("info", "reconcile.campaign", {
          projectId,
          platform: "google_ads",
          campaignId: row.id,
          from: row.status,
          to: mapped,
        });
      }
      continue;
    }
    if (row.platform === "meta_ads") {
      if (!m.ok) {
        errors.push({ campaign_id: row.id, platform: "meta_ads", error: m.err });
        continue;
      }
      const id = String(extId).replace(/\D/g, "");
      if (!id) {
        errors.push({ campaign_id: row.id, platform: "meta_ads", error: "ID Meta inválido." });
        continue;
      }
      const url = new URL(`${GRAPH}/${id}`);
      url.searchParams.set("fields", "status");
      url.searchParams.set("access_token", m.token);
      const res = await fetch(url.toString());
      const j = (await res.json()) as { status?: string; error?: { message?: string } };
      if (!res.ok || j.error) {
        const msg = j.error?.message ?? res.statusText;
        errors.push({ campaign_id: row.id, platform: "meta_ads", error: msg || String(res.status) });
        continue;
      }
      const mapped = mapMetaStatus(j.status);
      if (mapped == null) {
        skipped.push({ campaign_id: row.id, reason: `Meta status: ${String(j.status)}` });
        continue;
      }
      if (mapped !== row.status) {
        await prisma.paidAdsCampaign.update({ where: { id: row.id }, data: { status: mapped } });
        updated.push({
          campaign_id: row.id,
          platform: "meta_ads",
          before: row.status,
          after: mapped,
          remote: String(j.status),
        });
        paidLog("info", "reconcile.campaign", {
          projectId,
          platform: "meta_ads",
          campaignId: row.id,
          from: row.status,
          to: mapped,
        });
      }
      continue;
    }
    if (row.platform === "tiktok_ads") {
      const conn = await prisma.paidAdsTikTokConnection.findUnique({ where: { projectId } });
      if (!conn?.advertiserId) {
        errors.push({ campaign_id: row.id, platform: "tiktok_ads", error: "TikTok não ligado." });
        continue;
      }
      const env = (await tiktokApiPostWithTokenRetry<{
        list?: Array<{ campaign_id?: string; operation_status?: string }>;
      }>(projectId, "campaign/get/", {
        advertiser_id: conn.advertiserId,
        filtering: { campaign_ids: [String(extId)] },
        page: 1,
        page_size: 20,
      })) as { code: number; message: string; data?: { list?: Array<{ operation_status?: string }> } };
      if (env.code !== 0) {
        errors.push({ campaign_id: row.id, platform: "tiktok_ads", error: env.message || `code ${env.code}` });
        continue;
      }
      const list = env.data?.list ?? [];
      if (list.length === 0) {
        if (row.status !== "archived") {
          await prisma.paidAdsCampaign.update({ where: { id: row.id }, data: { status: "archived" } });
          updated.push({
            campaign_id: row.id,
            platform: "tiktok_ads",
            before: row.status,
            after: "archived",
            remote: "(not found)",
          });
          paidLog("warn", "reconcile.campaign", {
            projectId,
            platform: "tiktok_ads",
            campaignId: row.id,
            note: "remote campaign missing, marked archived",
          });
        }
        continue;
      }
      const op = list[0]?.operation_status;
      const mapped = mapTikTokStatus(op);
      if (mapped == null) {
        skipped.push({ campaign_id: row.id, reason: `TikTok operation_status: ${String(op)}` });
        continue;
      }
      if (mapped !== row.status) {
        await prisma.paidAdsCampaign.update({ where: { id: row.id }, data: { status: mapped } });
        updated.push({
          campaign_id: row.id,
          platform: "tiktok_ads",
          before: row.status,
          after: mapped,
          remote: String(op),
        });
        paidLog("info", "reconcile.campaign", {
          projectId,
          platform: "tiktok_ads",
          campaignId: row.id,
          from: row.status,
          to: mapped,
        });
      }
    }
  }

  paidLog("info", "reconcile.done", {
    projectId,
    nUpdated: updated.length,
    nErrors: errors.length,
    nSkipped: skipped.length,
  });

  return { ok: true, updated, errors, skipped };
}
