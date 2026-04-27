import { createFileRoute } from "@tanstack/react-router";
import { Prisma } from "@prisma/client";

import { prisma } from "@backend/prisma";

async function syncInsights(
  token: string,
  projectId: string,
  level: "campaign" | "adset" | "ad",
  externalId: string,
) {
  const url =
    `https://graph.facebook.com/v21.0/${externalId}/insights?` +
    new URLSearchParams({
      fields: "impressions,clicks,spend,ctr,actions",
      date_preset: "yesterday",
      access_token: token,
    }).toString();

  const res = await fetch(url);
  if (!res.ok) return false;
  const json = (await res.json()) as {
    data?: Array<{
      impressions?: string;
      clicks?: string;
      spend?: string;
      ctr?: string;
      actions?: Array<{ action_type?: string; value?: string }>;
      date_start?: string;
      date_stop?: string;
    }>;
  };
  const row = json.data?.[0];
  if (!row) return false;

  const conversions = (row.actions ?? [])
    .filter((a) =>
      ["purchase", "lead", "complete_registration", "offsite_conversion"].some((t) =>
        (a.action_type ?? "").includes(t),
      ),
    )
    .reduce((sum, a) => sum + Number(a.value ?? 0), 0);

  const dateStr = row.date_start ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  await prisma.metaInsight.upsert({
    where: {
      projectId_level_externalId_date: {
        projectId,
        level,
        externalId,
        date: new Date(`${dateStr}T12:00:00.000Z`),
      },
    },
    create: {
      projectId,
      level,
      externalId,
      date: new Date(`${dateStr}T12:00:00.000Z`),
      impressions: BigInt(Math.round(Number(row.impressions ?? 0))),
      clicks: BigInt(Math.round(Number(row.clicks ?? 0))),
      spendCents: BigInt(Math.round(Number(row.spend ?? 0) * 100)),
      conversions: BigInt(Math.round(conversions)),
      ctr: new Prisma.Decimal(row.ctr ?? 0),
      fetchedAt: new Date(),
    },
    update: {
      impressions: BigInt(Math.round(Number(row.impressions ?? 0))),
      clicks: BigInt(Math.round(Number(row.clicks ?? 0))),
      spendCents: BigInt(Math.round(Number(row.spend ?? 0) * 100)),
      conversions: BigInt(Math.round(conversions)),
      ctr: new Prisma.Decimal(row.ctr ?? 0),
      fetchedAt: new Date(),
    },
  });
  return true;
}

const STATUS_MAP: Record<string, "live" | "paused" | "archived" | "pending_publish" | "error"> = {
  ACTIVE: "live",
  PAUSED: "paused",
  ARCHIVED: "archived",
  DELETED: "archived",
  PENDING_REVIEW: "pending_publish",
  IN_PROCESS: "pending_publish",
  WITH_ISSUES: "error",
  DISAPPROVED: "error",
};

const CAMPAIGN_STATUS_MAP: Record<
  string,
  "live" | "paused" | "archived" | "pending_publish" | "error" | "draft"
> = {
  ACTIVE: "live",
  PAUSED: "paused",
  ARCHIVED: "archived",
  DELETED: "archived",
  PENDING_REVIEW: "pending_publish",
  IN_PROCESS: "pending_publish",
  WITH_ISSUES: "error",
  DISAPPROVED: "error",
};

export const Route = createFileRoute("/hooks/meta-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const secret = process.env.CRON_SECRET ?? "";
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const connections = await prisma.metaConnection.findMany({
          where: { status: "connected" },
          select: { id: true, projectId: true, tokenRef: true, adAccountId: true },
        });

        const summary = {
          connections: connections.length,
          campaigns_synced: 0,
          adsets_synced: 0,
          ads_synced: 0,
          errors: [] as Array<{ project_id: string; error: string }>,
        };

        for (const conn of connections) {
          if (!conn.tokenRef || !conn.adAccountId) continue;
          if (conn.tokenRef.startsWith("state:")) continue;

          try {
            const campaigns = await prisma.paidCampaign.findMany({
              where: {
                projectId: conn.projectId,
                platform: "meta_ads",
                externalCampaignId: { not: null },
              },
              select: { id: true, externalCampaignId: true },
            });

            for (const camp of campaigns) {
              if (!camp.externalCampaignId) continue;

              const cRes = await fetch(
                `https://graph.facebook.com/v21.0/${camp.externalCampaignId}?fields=effective_status,status&access_token=${encodeURIComponent(conn.tokenRef)}`,
              );
              const cJson = (await cRes.json()) as {
                effective_status?: string;
                status?: string;
                error?: { message?: string };
              };

              if (cJson.error) {
                summary.errors.push({
                  project_id: conn.projectId,
                  error: cJson.error.message ?? "graph error",
                });
                continue;
              }

              const mapped =
                CAMPAIGN_STATUS_MAP[cJson.effective_status ?? cJson.status ?? ""] ?? undefined;
              if (mapped) {
                await prisma.paidCampaign.update({
                  where: { id: camp.id },
                  data: { status: mapped },
                });
                summary.campaigns_synced++;
              }

              await syncInsights(
                conn.tokenRef,
                conn.projectId,
                "campaign",
                camp.externalCampaignId,
              );

              const adsets = await prisma.metaAdset.findMany({
                where: { campaignId: camp.id, externalId: { not: null } },
                select: { id: true, externalId: true },
              });

              for (const adset of adsets) {
                if (!adset.externalId) continue;
                const asRes = await fetch(
                  `https://graph.facebook.com/v21.0/${adset.externalId}?fields=effective_status,status&access_token=${encodeURIComponent(conn.tokenRef)}`,
                );
                const asJson = (await asRes.json()) as {
                  effective_status?: string;
                  status?: string;
                };
                const m = STATUS_MAP[asJson.effective_status ?? asJson.status ?? ""];
                if (m) {
                  await prisma.metaAdset.update({
                    where: { id: adset.id },
                    data: { status: m },
                  });
                  summary.adsets_synced++;
                }
                await syncInsights(conn.tokenRef, conn.projectId, "adset", adset.externalId);

                const ads = await prisma.metaAd.findMany({
                  where: { adsetId: adset.id, externalAdId: { not: null } },
                  select: { id: true, externalAdId: true },
                });

                for (const ad of ads) {
                  if (!ad.externalAdId) continue;
                  const adRes = await fetch(
                    `https://graph.facebook.com/v21.0/${ad.externalAdId}?fields=effective_status,status&access_token=${encodeURIComponent(conn.tokenRef)}`,
                  );
                  const adJson = (await adRes.json()) as {
                    effective_status?: string;
                    status?: string;
                  };
                  const ma = STATUS_MAP[adJson.effective_status ?? adJson.status ?? ""];
                  if (ma) {
                    await prisma.metaAd.update({
                      where: { id: ad.id },
                      data: { status: ma },
                    });
                    summary.ads_synced++;
                  }
                  await syncInsights(conn.tokenRef, conn.projectId, "ad", ad.externalAdId);
                }
              }
            }

            await prisma.metaConnection.update({
              where: { id: conn.id },
              data: { lastSyncAt: new Date(), errorMessage: null },
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            summary.errors.push({ project_id: conn.projectId, error: message });
            await prisma.metaConnection.update({
              where: { id: conn.id },
              data: {
                status: "error",
                errorMessage: message.slice(0, 500),
              },
            });
          }
        }

        return new Response(JSON.stringify({ success: true, summary }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
