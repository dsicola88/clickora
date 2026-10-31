/**
 * Fila persistente de sync de conversões (Meta CAPI / TikTok / Google Ads).
 * Enfileira em vez de fire-and-forget; worker com backoff e dead-letter.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { syncConversionToGoogleAds } from "../modules/googleAds/googleAds.service";
import { syncConversionToMetaCapi } from "../modules/metaCapi/metaCapi.service";
import { syncConversionToTikTokEvents } from "../modules/tiktokEvents/tiktokEvents.service";

export type ConversionSyncChannel = "google_ads" | "meta_capi" | "tiktok_events";

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

async function runChannel(channel: ConversionSyncChannel, conversionId: string): Promise<void> {
  if (channel === "google_ads") {
    await syncConversionToGoogleAds(conversionId);
    return;
  }
  if (channel === "meta_capi") {
    await syncConversionToMetaCapi(conversionId);
    return;
  }
  await syncConversionToTikTokEvents(conversionId);
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
  const candidates = await systemPrisma.conversionSyncJob.findMany({
    where: {
      status: "pending",
      runAfter: { lte: now },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    orderBy: { runAfter: "asc" },
    take: BATCH,
  });

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  let dead = 0;

  for (const job of candidates) {
    const upd = await systemPrisma.conversionSyncJob.updateMany({
      where: {
        id: job.id,
        status: "pending",
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
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
