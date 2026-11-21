/**
 * Importa campanhas TikTok remotas → paid_ads_campaigns.
 */
import type { PaidAdsCampaignStatus, Prisma } from "@prisma/client";

import { prisma } from "./paidPrisma";
import { listRemoteTikTokCampaigns } from "./tiktok-ads-manager.service";

function asStatus(s: "live" | "paused" | "archived"): PaidAdsCampaignStatus {
  return s === "archived" ? "paused" : s;
}

function mergeLanding(
  existing: Prisma.JsonValue | null | undefined,
  landingUrl: string | null | undefined,
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (landingUrl?.trim()) {
    base.clickora_landing_url = landingUrl.trim().slice(0, 2000);
  }
  return base as Prisma.InputJsonValue;
}

export async function importTikTokCampaigns(
  projectId: string,
  opts: {
    external_campaign_ids: string[];
    refresh_existing?: boolean;
    landing_url?: string | null;
  },
) {
  const project = await prisma.paidAdsProject.findFirst({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) return { ok: false as const, error: "Projeto não encontrado." };

  const remote = await listRemoteTikTokCampaigns(projectId);
  if (!remote.ok) return remote;

  const want = new Set(opts.external_campaign_ids.map((x) => String(x).trim()).filter(Boolean));
  if (want.size === 0) {
    return { ok: false as const, error: "Indique pelo menos um external_campaign_id." };
  }

  const landing = opts.landing_url?.trim() || null;
  const imported: Array<{ local_campaign_id: string; external_campaign_id: string; created: boolean }> =
    [];
  const skipped: Array<{ external_campaign_id: string; reason: string }> = [];

  for (const row of remote.campaigns) {
    if (!want.has(row.external_campaign_id)) continue;

    if (row.already_imported && row.local_campaign_id && !opts.refresh_existing) {
      skipped.push({
        external_campaign_id: row.external_campaign_id,
        reason: "already_imported",
      });
      continue;
    }

    const status = asStatus(row.status);
    let localId = row.local_campaign_id;
    let created = false;

    if (localId) {
      const existing = await prisma.paidAdsCampaign.findFirst({
        where: { id: localId, projectId },
        select: { biddingConfig: true },
      });
      await prisma.paidAdsCampaign.update({
        where: { id: localId },
        data: {
          name: row.name,
          status,
          dailyBudgetMicros:
            row.daily_budget_micros != null ? BigInt(row.daily_budget_micros) : undefined,
          objectiveSummary: row.objective ?? undefined,
          biddingConfig: mergeLanding(existing?.biddingConfig, landing),
        },
      });
    } else {
      const camp = await prisma.paidAdsCampaign.create({
        data: {
          userId: project.userId,
          projectId,
          platform: "tiktok_ads",
          externalCampaignId: row.external_campaign_id,
          name: row.name,
          status,
          dailyBudgetMicros:
            row.daily_budget_micros != null ? BigInt(row.daily_budget_micros) : null,
          objectiveSummary: row.objective,
          biddingConfig: mergeLanding(null, landing),
        },
      });
      localId = camp.id;
      created = true;
    }

    imported.push({
      local_campaign_id: localId!,
      external_campaign_id: row.external_campaign_id,
      created,
    });
  }

  return {
    ok: true as const,
    imported,
    skipped,
    landing_url_stored: Boolean(landing),
    note: landing
      ? "Landing Clickora guardada — CTAs da presell devem apontar a /track/r/."
      : "Sem landing_url: configure a URL da presell Clickora no anúncio TikTok.",
  };
}
