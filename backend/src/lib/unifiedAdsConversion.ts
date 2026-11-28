/**
 * Ledger único de vendas: postbacks Google/Microsoft Ads também gravam `Conversion`
 * (além do TrackingEvent histórico), para Relatórios/Resultados verem a mesma venda.
 *
 * Não dispara Meta CAPI / TikTok Events a partir deste caminho (origem = ads directo) —
 * evita atribuição cruzada falsa. Google continua via `syncDirectGclidConversionToGoogleAds`.
 */
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "./prisma";

export type AdsPostbackOrigin = "google_ads" | "microsoft_ads";

/** Identidade estável de dedupe para postbacks ads → Conversion. */
export function adsExternalOrderId(origin: AdsPostbackOrigin, transactionId: string): string {
  return `${origin}:${transactionId}`.slice(0, 190);
}

/**
 * Order ID enviado à rede de anúncios e usado no dedupe. Sem `transaction_id`, deriva do
 * click ID + nome da conversão: retries da rede não duplicam (no máx. 1 conversão por clique e acção).
 */
export function adsPostbackOrderId(
  transactionId: string | null | undefined,
  adClickId: string,
  conversionName?: string | null,
): string {
  const explicit = transactionId?.trim();
  if (explicit) return explicit;
  const digest = createHash("sha256")
    .update(`${adClickId.trim()}|${(conversionName ?? "").trim()}`)
    .digest("hex")
    .slice(0, 32);
  return `auto-${digest}`;
}

export type DirectGoogleAdsUploadResult = { attempted: boolean; ok: boolean; error?: string };

/** Regista no ledger o resultado real do upload directo (a UI não pode mostrar «Directo» quando falhou). */
export async function recordDirectGoogleAdsUpload(
  conversionId: string,
  orderId: string,
  upload: DirectGoogleAdsUploadResult,
): Promise<void> {
  const googleAdsSync = upload.ok ? "skipped_direct_upload" : upload.attempted ? "failed" : "skipped_no_config";
  await systemPrisma.conversion.update({
    where: { id: conversionId },
    data: {
      googleAdsSync,
      googleAdsSyncedAt: upload.ok ? new Date() : undefined,
      googleAdsSyncDetail: {
        direct_upload: upload.ok ? "sent" : upload.attempted ? "failed" : "not_ready",
        order_id: orderId,
        ...(upload.ok
          ? {}
          : {
              reason: upload.attempted
                ? upload.error || "erro"
                : "Upload Google Ads ainda não pronto — ligue a conta em Integrações → Google Ads.",
            }),
      } as Prisma.InputJsonValue,
    },
  });
}

export async function findClickIdByAdClickParam(args: {
  userId: string;
  presellPageId: string;
  param: "gclid" | "msclkid";
  value: string;
}): Promise<string | null> {
  const value = args.value.trim();
  if (!value) return null;
  const row = await systemPrisma.trackingEvent.findFirst({
    where: {
      userId: args.userId,
      presellPageId: args.presellPageId,
      eventType: "click",
      metadata: { path: [args.param], equals: value },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Cria (ou devolve duplicado) uma linha Conversion alinhada ao postback ads.
 * Idempotente por `externalOrderId` = `{origin}:{transactionId}`.
 */
export async function upsertConversionFromAdsPostback(args: {
  userId: string;
  presellId: string;
  clickId: string | null;
  amount: number;
  currency: string;
  campaign?: string | null;
  origin: AdsPostbackOrigin;
  transactionId: string;
  adClickId: string;
  conversionName?: string | null;
}): Promise<{ conversionId: string; created: boolean; duplicate: boolean }> {
  const externalOrderId = adsExternalOrderId(args.origin, args.transactionId);
  const existing = await systemPrisma.conversion.findFirst({
    where: { userId: args.userId, externalOrderId },
    select: { id: true },
  });
  if (existing) {
    return { conversionId: existing.id, created: false, duplicate: true };
  }

  const attribution = args.clickId ? "attributed" : "unattributed";
  const metadata: Prisma.InputJsonValue = {
    postback_origin: args.origin,
    conversion_name: args.conversionName ?? null,
    ...(args.origin === "google_ads" ? { gclid: args.adClickId } : { msclkid: args.adClickId }),
    ledger: "unified_ads_postback",
  };

  try {
    const created = await systemPrisma.conversion.create({
      data: {
        userId: args.userId,
        presellId: args.presellId,
        clickId: args.clickId,
        campaign: args.campaign ?? undefined,
        amount: new Prisma.Decimal(args.amount),
        currency: args.currency.toUpperCase().slice(0, 8),
        status: "approved",
        attribution,
        externalOrderId,
        /** Sync ads já tratado pelo upload directo / não aplicar CAPI cruzado. */
        googleAdsSync: args.origin === "google_ads" ? "skipped_direct_upload" : "skipped_ads_direct",
        metaCapiSync: "skipped_ads_direct",
        tiktokEventsSync: "skipped_ads_direct",
        metadata,
      },
      select: { id: true },
    });
    return { conversionId: created.id, created: true, duplicate: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const again = await systemPrisma.conversion.findFirst({
        where: { userId: args.userId, externalOrderId },
        select: { id: true },
      });
      if (again) return { conversionId: again.id, created: false, duplicate: true };
    }
    throw e;
  }
}
