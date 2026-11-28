/**
 * Fila persistente de sync de conversões (Meta CAPI / TikTok / Google Ads).
 * Enfileira em vez de fire-and-forget; worker com backoff e dead-letter.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import {
  restateConversionToGoogleAds,
  retractConversionFromGoogleAds,
  syncConversionToGoogleAds,
} from "../modules/googleAds/googleAds.service";
import { retractConversionFromMetaCapi, syncConversionToMetaCapi } from "../modules/metaCapi/metaCapi.service";
import {
  retractConversionFromTikTokEvents,
  syncConversionToTikTokEvents,
} from "../modules/tiktokEvents/tiktokEvents.service";

export type ConversionSyncChannel =
  | "google_ads"
  | "meta_capi"
  | "tiktok_events"
  | "google_ads_restate"
  | "google_ads_refund"
  | "meta_capi_refund"
  | "tiktok_events_refund";

export const REFUND_SYNC_CHANNELS: ConversionSyncChannel[] = [
  "google_ads_refund",
  "meta_capi_refund",
  "tiktok_events_refund",
];

const MAX_ATTEMPTS = Math.max(1, Math.min(10, Number(process.env.CONVERSION_SYNC_MAX_ATTEMPTS || "5") || 5));
const LEASE_MS = Math.max(15_000, Math.min(300_000, Number(process.env.CONVERSION_SYNC_LEASE_MS || "60000") || 60_000));
const BATCH = Math.max(1, Math.min(50, Number(process.env.CONVERSION_SYNC_BATCH || "10") || 10));

function backoffSeconds(attempts: number): number {
  return Math.min(3600, Math.pow(2, Math.max(0, attempts)) * 15);
}

export async function enqueueConversionSync(args: {
  conversionId: string;
  userId: string;
  channels?: ConversionSyncChannel[];
}): Promise<{ enqueued: ConversionSyncChannel[] }> {
  const channels = args.channels ?? (["google_ads", "meta_capi", "tiktok_events"] as ConversionSyncChannel[]);
  const enqueued: ConversionSyncChannel[] = [];
  for (const channel of channels) {
    const existing = await systemPrisma.conversionSyncJob.findFirst({
      where: {
        conversionId: args.conversionId,
        channel,
        status: { in: ["pending", "processing"] },
      },
      select: { id: true },
    });
    if (existing) {
      enqueued.push(channel);
      continue;
    }
    try {
      await systemPrisma.conversionSyncJob.create({
        data: {
          id: randomUUID(),
          conversionId: args.conversionId,
          userId: args.userId,
          channel,
          status: "pending",
          maxAttempts: MAX_ATTEMPTS,
          runAfter: new Date(),
        },
      });
      enqueued.push(channel);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        enqueued.push(channel);
        continue;
      }
      console.error("[conversionSyncQueue.enqueue]", channel, e);
    }
  }
  return { enqueued };
}

const CHANNEL_RUNNERS: Record<ConversionSyncChannel, (conversionId: string) => Promise<void>> = {
  google_ads: syncConversionToGoogleAds,
  meta_capi: syncConversionToMetaCapi,
  tiktok_events: syncConversionToTikTokEvents,
  google_ads_restate: restateConversionToGoogleAds,
  google_ads_refund: retractConversionFromGoogleAds,
  meta_capi_refund: retractConversionFromMetaCapi,
  tiktok_events_refund: retractConversionFromTikTokEvents,
};

async function runChannel(channel: ConversionSyncChannel, conversionId: string): Promise<void> {
  const run = CHANNEL_RUNNERS[channel];
  if (!run) throw new Error(`canal de sync desconhecido: ${channel}`);
  await run(conversionId);
}

/**
 * Claim + processa um lote. Seguro para múltiplas instâncias (lease).
 */
export async function processConversionSyncBatch(owner = `api-${process.pid}`): Promise<{
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
}> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  /** `processing` com lease expirado há mais de um lease: o worker caiu a meio (redeploy/crash). Reenvio é idempotente (order_id / event_id). */
  const staleProcessingBefore = new Date(now.getTime() - LEASE_MS);
  const claimable: Prisma.ConversionSyncJobWhereInput = {
    OR: [
      {
        status: "pending",
        runAfter: { lte: now },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      { status: "processing", leaseUntil: { lt: staleProcessingBefore } },
    ],
  };
  const candidates = await systemPrisma.conversionSyncJob.findMany({
    where: claimable,
    orderBy: { runAfter: "asc" },
    take: BATCH,
  });

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  let dead = 0;

  for (const job of candidates) {
    const upd = await systemPrisma.conversionSyncJob.updateMany({
      where: { id: job.id, ...claimable },
      data: {
        status: "processing",
        leaseOwner: owner,
        leaseUntil,
        attempts: { increment: 1 },
      },
    });
    if (upd.count !== 1) continue;
    claimed += 1;

    const attempts = job.attempts + 1;
    try {
      await runChannel(job.channel as ConversionSyncChannel, job.conversionId);
      await systemPrisma.conversionSyncJob.update({
        where: { id: job.id },
        data: { status: "sent", lastError: null, leaseOwner: null, leaseUntil: null },
      });
      sent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempts >= job.maxAttempts) {
        await systemPrisma.conversionSyncJob.update({
          where: { id: job.id },
          data: {
            status: "dead",
            lastError: msg.slice(0, 500),
            leaseOwner: null,
            leaseUntil: null,
          },
        });
        dead += 1;
      } else {
        const runAfter = new Date(Date.now() + backoffSeconds(attempts) * 1000);
        await systemPrisma.conversionSyncJob.update({
          where: { id: job.id },
          data: {
            status: "pending",
            lastError: msg.slice(0, 500),
            runAfter,
            leaseOwner: null,
            leaseUntil: null,
          },
        });
        failed += 1;
      }
    }
  }

  return { claimed, sent, failed, dead };
}

/**
 * Reprocessa jobs `dead` do utilizador (volta a `pending`).
 * Não inventa credenciais — se a rede falhar outra vez, volta a dead.
 */
export async function retryDeadConversionSyncJobs(args: {
  userId: string;
  limit?: number;
  channel?: ConversionSyncChannel;
}): Promise<{ reset: number }> {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const dead = await systemPrisma.conversionSyncJob.findMany({
    where: {
      userId: args.userId,
      status: "dead",
      ...(args.channel ? { channel: args.channel } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true },
  });
  if (dead.length === 0) return { reset: 0 };
  const upd = await systemPrisma.conversionSyncJob.updateMany({
    where: { id: { in: dead.map((d) => d.id) }, status: "dead" },
    data: {
      status: "pending",
      attempts: 0,
      runAfter: new Date(),
      lastError: null,
      leaseOwner: null,
      leaseUntil: null,
    },
  });
  return { reset: upd.count };
}

export function registerConversionSyncScheduler(): void {
  const enabled = process.env.CONVERSION_SYNC_QUEUE !== "0";
  if (!enabled) {
    console.log("[conversion-sync] fila desactivada (CONVERSION_SYNC_QUEUE=0)");
    return;
  }
  const everyMs = Math.max(10_000, Math.min(300_000, Number(process.env.CONVERSION_SYNC_INTERVAL_MS || "30000") || 30_000));
  console.log(`[conversion-sync] worker a cada ${everyMs}ms`);
  setInterval(() => {
    void processConversionSyncBatch().catch((err) => console.error("[conversion-sync]", err));
  }, everyMs);
  void processConversionSyncBatch().catch((err) => console.error("[conversion-sync]", err));
}
