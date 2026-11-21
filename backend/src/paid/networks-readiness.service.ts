/**
 * Cockpit multi-rede: ligação, inventário ligado, landings Clickora, estado do Autopilot.
 * Só lê estado — não muta redes.
 */
import {
  optimizerDryRun,
  optimizerEnabled,
  optimizerRulesPhase,
} from "./optimizer/config";
import { prisma } from "./paidPrisma";

function landingFromBidding(biddingConfig: unknown): string | null {
  if (!biddingConfig || typeof biddingConfig !== "object" || Array.isArray(biddingConfig)) {
    return null;
  }
  const v = (biddingConfig as Record<string, unknown>).clickora_landing_url;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function fetchNetworksReadiness(projectId: string) {
  const [googleConn, metaConn, tiktokConn, campaigns] = await Promise.all([
    prisma.paidAdsGoogleAdsConnection.findUnique({ where: { projectId } }),
    prisma.paidAdsMetaConnection.findUnique({ where: { projectId } }),
    prisma.paidAdsTikTokConnection.findUnique({ where: { projectId } }),
    prisma.paidAdsCampaign.findMany({
      where: { projectId, status: { not: "archived" } },
      select: {
        id: true,
        platform: true,
        status: true,
        externalCampaignId: true,
        tiktokAdGroupId: true,
        tiktokAdId: true,
        biddingConfig: true,
        metaAdsets: {
          select: {
            id: true,
            creatives: { select: { destinationUrl: true }, take: 3 },
          },
          take: 3,
        },
      },
    }),
  ]);

  const byPlat = (p: "google_ads" | "meta_ads" | "tiktok_ads") =>
    campaigns.filter((c) => c.platform === p);

  const google = byPlat("google_ads");
  const meta = byPlat("meta_ads");
  const tiktok = byPlat("tiktok_ads");

  const metaMissingLanding = meta.filter((c) => {
    if (landingFromBidding(c.biddingConfig)) return false;
    const dest = c.metaAdsets.flatMap((a) => a.creatives.map((cr) => cr.destinationUrl)).filter(Boolean);
    return dest.length === 0;
  }).length;

  const tiktokMissingAd = tiktok.filter(
    (c) => Boolean(c.externalCampaignId && c.tiktokAdGroupId) && !c.tiktokAdId,
  ).length;
  const tiktokMissingLanding = tiktok.filter((c) => !landingFromBidding(c.biddingConfig)).length;

  const googleConnected = googleConn?.status === "connected";
  const metaConnected = metaConn?.status === "connected";
  const tiktokConnected = tiktokConn?.status === "connected";

  return {
    ok: true as const,
    google: {
      connected: googleConnected,
      campaigns: google.length,
      linked: google.filter((c) => Boolean(c.externalCampaignId)).length,
      live: google.filter((c) => c.status === "live").length,
      manager_ready: googleConnected,
    },
    meta: {
      connected: metaConnected,
      campaigns: meta.length,
      linked: meta.filter((c) => Boolean(c.externalCampaignId)).length,
      live: meta.filter((c) => c.status === "live").length,
      missing_landing: metaMissingLanding,
      manager_ready: metaConnected,
    },
    tiktok: {
      connected: tiktokConnected,
      campaigns: tiktok.length,
      linked: tiktok.filter((c) => Boolean(c.externalCampaignId)).length,
      live: tiktok.filter((c) => c.status === "live").length,
      with_ad: tiktok.filter((c) => Boolean(c.tiktokAdId)).length,
      missing_ad: tiktokMissingAd,
      missing_landing: tiktokMissingLanding,
      manager_ready: tiktokConnected,
    },
    optimizer: {
      enabled: optimizerEnabled(),
      dry_run: optimizerDryRun(),
      rules_phase: optimizerRulesPhase(),
      covers: ["google_ads", "meta_ads", "tiktok_ads"] as const,
      note:
        "Pausa / escala / redistribuição / flag criativo nas 3 redes. dry_run=true por defeito até activar PAID_OPTIMIZER_DRY_RUN=false.",
    },
    score: {
      /** 0–100 heuristic para media buyer: ligações + inventário ligado + landings. */
      value: (() => {
        let s = 40; // base funnel Clickora
        if (googleConnected || metaConnected || tiktokConnected) s += 15;
        if (googleConnected) s += 10;
        if (metaConnected) s += 10;
        if (tiktokConnected) s += 10;
        if (google.some((c) => c.externalCampaignId) || meta.some((c) => c.externalCampaignId) || tiktok.some((c) => c.externalCampaignId)) {
          s += 10;
        }
        if (metaMissingLanding === 0 && tiktokMissingLanding === 0) s += 5;
        if (tiktokMissingAd === 0) s += 5;
        if (optimizerEnabled() && !optimizerDryRun()) s += 5;
        return Math.min(100, s);
      })(),
    },
  };
}
