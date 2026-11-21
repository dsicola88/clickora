/**
 * Importa campanhas Meta remotas → paid_ads_campaigns (+ adset stub).
 * Landing Clickora opcional: grava em biddingConfig.clickora_landing_url para o funil.
 */
import type { PaidAdsCampaignStatus, Prisma } from "@prisma/client";

import { listRemoteMetaCampaigns, mapMetaStatus } from "./meta-ads-manager.service";
import { prisma } from "./paidPrisma";
import { isOAuthPendingToken, loadPaidToken } from "./tokenSecrets";

const GRAPH = "https://graph.facebook.com/v21.0";

function asStatus(s: "live" | "paused" | "archived"): PaidAdsCampaignStatus {
  return s;
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

async function fetchPrimaryAdset(
  token: string,
  campaignExtId: string,
): Promise<{ id: string; name: string; status: string; daily_budget?: string } | null> {
  const u = new URL(`${GRAPH}/${campaignExtId.replace(/\D/g, "")}/adsets`);
  u.searchParams.set("access_token", token);
  u.searchParams.set("fields", "id,name,status,daily_budget");
  u.searchParams.set("limit", "5");
  const res = await fetch(u.toString());
  const j = (await res.json()) as {
    data?: Array<{ id?: string; name?: string; status?: string; daily_budget?: string }>;
  };
  const first = j.data?.[0];
  if (!first?.id) return null;
  return {
    id: String(first.id).replace(/\D/g, ""),
    name: String(first.name ?? "Ad set").slice(0, 255),
    status: String(first.status ?? "PAUSED"),
    daily_budget: first.daily_budget,
  };
}

export async function importMetaCampaigns(
  projectId: string,
  opts: {
    external_campaign_ids: string[];
    refresh_existing?: boolean;
    /** Final URL Clickora (presell) — recomendado para tracking. */
    landing_url?: string | null;
  },
) {
  const project = await prisma.paidAdsProject.findFirst({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) return { ok: false as const, error: "Projeto não encontrado." };

  const remote = await listRemoteMetaCampaigns(projectId);
  if (!remote.ok) return remote;

  const conn = await prisma.paidAdsMetaConnection.findUnique({ where: { projectId } });
  if (!conn?.tokenRef || isOAuthPendingToken(conn.tokenRef)) {
    return { ok: false as const, error: "Sessão Meta inválida." };
  }
  const token = loadPaidToken(conn.tokenRef);
  if (!token) return { ok: false as const, error: "Token Meta em falta." };

  const want = new Set(opts.external_campaign_ids.map((x) => x.replace(/\D/g, "")).filter(Boolean));
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

    const status = asStatus(row.status === "archived" ? "paused" : row.status);
    const dailyMicros =
      row.daily_budget_cents != null ? Math.round(row.daily_budget_cents * 10_000) : null;

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
          dailyBudgetMicros: dailyMicros != null ? BigInt(dailyMicros) : undefined,
          objectiveSummary: row.objective ?? undefined,
          biddingConfig: mergeLanding(existing?.biddingConfig, landing),
        },
      });
    } else {
      const camp = await prisma.paidAdsCampaign.create({
        data: {
          userId: project.userId,
          projectId,
          platform: "meta_ads",
          externalCampaignId: row.external_campaign_id,
          name: row.name,
          status,
          dailyBudgetMicros: dailyMicros != null ? BigInt(dailyMicros) : null,
          objectiveSummary: row.objective,
          biddingConfig: mergeLanding(null, landing),
        },
      });
      localId = camp.id;
      created = true;
    }

    const adsetRemote = await fetchPrimaryAdset(token, row.external_campaign_id);
    if (adsetRemote && localId) {
      const existingAdset = await prisma.paidAdsMetaAdset.findFirst({
        where: { campaignId: localId, externalId: adsetRemote.id },
      });
      const cents =
        adsetRemote.daily_budget != null && Number.isFinite(Number(adsetRemote.daily_budget))
          ? Math.round(Number(adsetRemote.daily_budget))
          : row.daily_budget_cents;
      const adsetStatus = mapMetaStatus(adsetRemote.status) === "live" ? "live" : "paused";
      if (existingAdset) {
        await prisma.paidAdsMetaAdset.update({
          where: { id: existingAdset.id },
          data: {
            name: adsetRemote.name,
            status: adsetStatus,
            dailyBudgetCents: cents != null ? BigInt(cents) : undefined,
          },
        });
      } else {
        const anyLocal = await prisma.paidAdsMetaAdset.findFirst({ where: { campaignId: localId } });
        if (!anyLocal) {
          await prisma.paidAdsMetaAdset.create({
            data: {
              campaignId: localId,
              externalId: adsetRemote.id,
              name: adsetRemote.name,
              status: adsetStatus,
              dailyBudgetCents: cents != null ? BigInt(cents) : null,
            },
          });
        } else if (!anyLocal.externalId) {
          await prisma.paidAdsMetaAdset.update({
            where: { id: anyLocal.id },
            data: {
              externalId: adsetRemote.id,
              name: adsetRemote.name,
              status: adsetStatus,
              dailyBudgetCents: cents != null ? BigInt(cents) : undefined,
            },
          });
        }
      }
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
      ? "Landing Clickora guardada em biddingConfig.clickora_landing_url — use CTAs /track/r/ na presell."
      : "Sem landing_url: ligue a Final URL da presell Clickora no criativo Meta e no hop /track/r/.",
  };
}
