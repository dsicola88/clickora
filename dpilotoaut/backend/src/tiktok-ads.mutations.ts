/**
 * Mutações TikTok: orçamento, pausar campanha/ad group.
 */
import type { ChangeRequestType } from "@prisma/client";

import { prisma } from "./prisma";

const TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3";

type Env<T = unknown> = { code: number; message: string; data?: T };

export type CrResult = { ok: true } | { ok: false; error: string };

async function getConn(projectId: string) {
  return prisma.tikTokConnection.findUnique({ where: { projectId } });
}

async function apiPost<T>(path: string, accessToken: string, body: object): Promise<Env<T>> {
  const res = await fetch(`${TIKTOK_BASE}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Access-Token": accessToken,
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Env<T>;
}

export async function applyTiktokUpdateBudget(
  projectId: string,
  p: {
    level: "campaign" | "adgroup";
    campaign_id: string;
    /** micros; campanha local */
    daily_budget_micros: number;
  },
): Promise<CrResult> {
  const conn = await getConn(projectId);
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.advertiserId) {
    return { ok: false, error: "Ligue a conta TikTok (OAuth) e o advertiser." };
  }
  const camp = await prisma.paidCampaign.findFirst({
    where: { id: p.campaign_id, projectId, platform: "tiktok_ads" },
  });
  if (!camp) return { ok: false, error: "Campanha TikTok não encontrada." };
  const daily = Math.max(20, Math.round((p.daily_budget_micros / 1_000_000) * 100) / 100);

  if (p.level === "campaign") {
    if (!camp.externalCampaignId) {
      return { ok: false, error: "Sem campanha remota; aplique a criação antes." };
    }
    const r = await apiPost("campaign/update/", conn.tokenRef, {
      advertiser_id: conn.advertiserId,
      campaign_id: camp.externalCampaignId,
      budget_mode: "BUDGET_MODE_DAY",
      budget: daily,
    });
    if (r.code !== 0) {
      return { ok: false, error: r.message || `TikTok campaign update (${r.code})` };
    }
  } else {
    if (!camp.tiktokAdGroupId) {
      return { ok: false, error: "Sem ad group TikTok; crie/ publique a campanha com ad group." };
    }
    const r = await apiPost("adgroup/update/", conn.tokenRef, {
      advertiser_id: conn.advertiserId,
      adgroup_id: camp.tiktokAdGroupId,
      budget_mode: "BUDGET_MODE_DAY",
      budget: daily,
    });
    if (r.code !== 0) {
      return { ok: false, error: r.message || `TikTok ad group update (${r.code})` };
    }
  }
  await prisma.paidCampaign.update({
    where: { id: camp.id },
    data: { dailyBudgetMicros: BigInt(Math.round(p.daily_budget_micros)) },
  });
  return { ok: true };
}

export async function applyTiktokPauseEntity(
  projectId: string,
  p: { level: "campaign" | "adgroup"; campaign_id: string },
): Promise<CrResult> {
  const conn = await getConn(projectId);
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.advertiserId) {
    return { ok: false, error: "Ligue a conta TikTok (OAuth) e o advertiser." };
  }
  const c = await prisma.paidCampaign.findFirst({
    where: { id: p.campaign_id, projectId, platform: "tiktok_ads" },
  });
  if (!c) return { ok: false, error: "Campanha TikTok não encontrada." };

  if (p.level === "campaign") {
    if (!c.externalCampaignId) {
      return { ok: false, error: "Campanha sem ID TikTok remoto." };
    }
    const r = await apiPost("campaign/update/", conn.tokenRef, {
      advertiser_id: conn.advertiserId,
      campaign_id: c.externalCampaignId,
      operation_status: "DISABLE",
    });
    if (r.code !== 0) {
      return { ok: false, error: r.message || "Pausar campanha TikTok" };
    }
    await prisma.paidCampaign.update({ where: { id: c.id }, data: { status: "paused" } });
    return { ok: true };
  }
  if (!c.tiktokAdGroupId) {
    return { ok: false, error: "Sem ad group remoto; publique a criação da campanha + ad group." };
  }
  const r2 = await apiPost("adgroup/update/", conn.tokenRef, {
    advertiser_id: conn.advertiserId,
    adgroup_id: c.tiktokAdGroupId,
    operation_status: "DISABLE",
  });
  if (r2.code !== 0) {
    return { ok: false, error: r2.message || "Pausar ad group TikTok" };
  }
  return { ok: true };
}

export function isTiktokMutationType(
  t: ChangeRequestType,
): t is "tiktok_update_budget" | "tiktok_pause_entity" {
  return t === "tiktok_update_budget" || t === "tiktok_pause_entity";
}
