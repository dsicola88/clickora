import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import { createPostbackToken, verifyPostbackToken } from "../lib/postbackToken";
import { publicApiBaseFromRequest } from "../lib/publicApiBase";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "../lib/mailer";
import { flattenAffiliatePayload } from "../lib/affiliatePostbackParsers";
import {
  buildTestSaleQuery,
  classifyRefundAdjustment,
  fallbackExternalId,
  jvzooCverifyMatches,
  jvzooSignedFields,
  metadataWithRefundTxn,
  parseAffiliatePostback,
  redactAffiliateFlat,
  refundTransactionIds,
} from "../lib/affiliatePlatforms/parseAffiliatePostback";
import { recordAffiliateFunnelStep } from "../lib/funnelStepEvent";
import { extractClientIp } from "../lib/clientIp";
import {
  bootstrapGoogleAdsAfterOAuth,
  getGoogleAdsApiClientConfigFromEnv,
  isGoogleAdsClickUploadReadyForUser,
  restateConversionToGoogleAds,
  retractConversionFromGoogleAds,
  syncConversionToGoogleAds,
} from "../modules/googleAds/googleAds.service";
import { syncAdCostsForUser } from "../modules/affiliateOps/costSync.service";
import {
  isMetaCapiReadyForUser,
  retractConversionFromMetaCapi,
  reportPartialRefundToMetaCapi,
  syncConversionToMetaCapi,
} from "../modules/metaCapi/metaCapi.service";
import {
  isTikTokEventsReadyForUser,
  retractConversionFromTikTokEvents,
  reportPartialRefundToTikTokEvents,
  syncConversionToTikTokEvents,
} from "../modules/tiktokEvents/tiktokEvents.service";
import { normalizeIpForMatch } from "../lib/normalizeIp";
import { effectiveAutoBlacklistThreshold } from "../lib/trackingGuardPolicy";
import { sendTelegram } from "../lib/telegram";
import { isApprovedSaleNotice } from "../lib/saleNotice";
import { notifyApprovedSale } from "../lib/saleAlerts";
import {
  ensureWebPushFromEnv,
  getVapidPublicKeyFromEnv,
  isWebPushConfigured,
  sendWebPushToUser,
} from "../lib/webPush";
import { decryptSecretField, encryptSecretField } from "../lib/fieldEncryption";
import { clickbankSaleFields, decryptClickbankNotification } from "../lib/affiliatePlatforms/clickbankIns";
import {
  buildGoogleAdsAuthorizeUrl,
  exchangeGoogleAdsAuthorizationCode,
  getPrimaryFrontendOrigin,
  signGoogleAdsOAuthState,
  verifyGoogleAdsOAuthState,
} from "../lib/googleAdsOAuthFlow";
import { actorUserId, billingUserId } from "../lib/requestContext";
import { planAllowsAffiliateWebhook } from "../lib/planAffiliateWebhook";

const profileNotifySchema = z.object({
  sale_notify_email: z.union([z.string().email(), z.literal("")]).optional(),
});

async function subscriptionPlanForWebhookGate(userId: string) {
  return systemPrisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
}

export const integrationsController = {
  /** URL do webhook + estado (autenticado). */
  async getAffiliateWebhookInfo(req: Request, res: Response) {
    const userId = billingUserId(req);
    const sub = await subscriptionPlanForWebhookGate(userId);
    if (!planAllowsAffiliateWebhook(sub?.plan)) {
      return res.status(403).json({
        error:
          "Webhook de afiliados não está activo no seu plano. Faça upgrade ou peça ao administrador para activar esta opção no plano.",
        code: "AFFILIATE_WEBHOOK_PLAN",
      });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { saleNotifyEmail: true, email: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const token = createPostbackToken(userId);
    if (!token) {
      return res.status(503).json({ error: "JWT_SECRET não configurado no servidor." });
    }
    const base = publicApiBaseFromRequest(req);
    const hook_url = `${base}/integrations/affiliate-webhook?token=${encodeURIComponent(token)}`;
    const checkoutPixelUrl = `${base}/track/funnel/checkout.gif?token=${encodeURIComponent(token)}`;
    const landerPixelUrl = `${base}/track/funnel/lander.gif?token=${encodeURIComponent(token)}`;
    /** HTML genérico: redes com campo Funnel/Offer Pixel. Tenta ler subid da URL. */
    const buildFunnelHtml = (pixelUrl: string) =>
      `<script>(function(){try{var q=new URLSearchParams(location.search);` +
      `var s=q.get("clickora_click_id")||q.get("subid")||q.get("SUBID")||q.get("cid")||q.get("sid1")||q.get("sub3")||q.get("src")||q.get("tid")||"";` +
      `var u=${JSON.stringify(pixelUrl)}+(s?"&subid="+encodeURIComponent(s):"")+"&_="+Date.now();` +
      `new Image().src=u;}catch(e){}})();</script>`;

    res.json({
      hook_url,
      sale_notify_email: user.saleNotifyEmail ?? "",
      fallback_account_email: user.email,
      smtp_configured: isTransactionalEmailConfigured(),
      funnel: {
        checkout_html: buildFunnelHtml(checkoutPixelUrl),
        lander_html: buildFunnelHtml(landerPixelUrl),
        checkout_pixel_url: checkoutPixelUrl,
        lander_pixel_url: landerPixelUrl,
        /** S2S Event postback (SmartAdv, etc.): GET/POST no webhook com funnel_step. */
        checkout_event_postback_url: `${hook_url}&funnel_step=checkout&status=checkout`,
        lander_event_postback_url: `${hook_url}&funnel_step=lander&status=lander`,
      },
      /** @deprecated alias — manter até clientes antigos actualizarem */
      buygoods_funnel_pixels: {
        checkout_html: buildFunnelHtml(checkoutPixelUrl),
        lander_html: buildFunnelHtml(landerPixelUrl),
        checkout_pixel_url: checkoutPixelUrl,
        lander_pixel_url: landerPixelUrl,
      },
    });
  },

  /**
   * Postback HTTP das redes. Com status de venda aprovada:
   * - click UUID válido → conversão atribuída (várias vendas/rebills por clique se order_id distinto);
   * - sem UUID / clique inexistente → conversão **não atribuída** (venda registada, sem inventar GCLID/presell).
   */
  async affiliateWebhook(req: Request, res: Response) {
    const tokenRaw = req.query.token?.toString();
    const decoded = tokenRaw ? verifyPostbackToken(tokenRaw) : null;
    if (!decoded) return res.status(401).json({ error: "Token inválido ou ausente" });

    const subGate = await subscriptionPlanForWebhookGate(decoded.userId);
    if (!planAllowsAffiliateWebhook(subGate?.plan)) {
      return res.status(403).json({
        error: "Webhook de afiliados não está activo para esta conta.",
        code: "AFFILIATE_WEBHOOK_PLAN",
      });
    }

    const user = await systemPrisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, saleNotifyEmail: true, jvzooIpnSecret: true, clickbankInsSecret: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const flatRaw = flattenAffiliatePayload(req);
    const flat = redactAffiliateFlat(flatRaw);
    const platformLabel =
      flat.platform ||
      pickString(req.query.platform?.toString(), (req.body as Record<string, unknown>)?.platform) ||
      "";
    let parseFlat = flatRaw;
    let parseBody: unknown = req.body;
    const envelope = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : null;
    const notification = typeof envelope?.notification === "string" ? envelope.notification : "";
    const insIv = typeof envelope?.iv === "string" ? envelope.iv : "";
    if (notification && insIv) {
      const secret = decryptSecretField(user.clickbankInsSecret);
      const reason = !secret
        ? "clickbank_secret_missing"
        : null;
      const plain = secret ? decryptClickbankNotification(notification, insIv, secret) : null;
      const fields = plain ? clickbankSaleFields(plain) : null;
      if (reason || !fields) {
        const why = reason || "clickbank_decrypt_failed";
        await systemPrisma.postbackLog.create({
          data: {
            userId: user.id,
            platform: "clickbank",
            status: "rejected",
            message: why,
            payload: { platform: "clickbank", conversion: "ignored", reason: why, flat } as Prisma.InputJsonValue,
          },
        });
        return res.status(200).json({ ok: true, ignored: true, conversion: "ignored", reason: why });
      }
      parseFlat = { ...flatRaw, ...fields };
      delete parseFlat.notification;
      delete parseFlat.iv;
      parseBody = fields;
    }
    const parsed = parseAffiliatePostback({ platform: platformLabel || (notification ? "ClickBank" : ""), flat: parseFlat, body: parseBody });
    const platform = parsed.adapterId;
    const clickId = parsed.clickId;
    const statusRaw = parsed.statusRaw ?? undefined;
    const approved = parsed.outcome.kind === "approved";
    const externalOrderId = fallbackExternalId(parsed);
    const amount = parsed.amount;
    const currency = parsed.currency;

    if (parsed.adapterId === "jvzoo" && (flat.ctransaction || flat.cverify)) {
      const secret = decryptSecretField(user.jvzooIpnSecret);
      const signed = jvzooSignedFields(req.body);
      const reason = !secret
        ? "jvzoo_secret_missing"
        : jvzooCverifyMatches(signed, secret)
          ? null
          : "jvzoo_cverify_invalid";
      if (reason) {
        await systemPrisma.postbackLog.create({
          data: {
            userId: user.id,
            platform,
            status: "rejected",
            message: reason,
            payload: {
              platform,
              conversion: "ignored",
              reason,
              click_id: clickId,
              external_order_id: externalOrderId,
              flat,
            } as Prisma.InputJsonValue,
          },
        });
        return res.status(200).json({
          ok: true,
          ignored: true,
          conversion: "ignored",
          reason,
        });
      }
    }

    if (parsed.outcome.kind === "funnel") {
      const funnelStep = parsed.outcome.step;
      const ip = extractClientIp(req);
      const userAgent = req.headers["user-agent"] || "";
      const referrer = typeof req.headers.referer === "string" ? req.headers.referer : null;
      const result = await recordAffiliateFunnelStep({
        userId: user.id,
        step: funnelStep,
        platform,
        clickIdCandidate: clickId,
        ip,
        userAgent,
        referrer,
        headers: req.headers as Record<string, string | string[] | undefined>,
        extraMeta: { postback_funnel: true, flat_keys: Object.keys(flat).slice(0, 40) },
      });
      await systemPrisma.postbackLog.create({
        data: {
          userId: user.id,
          platform,
          status: result.duplicate ? "funnel_duplicate" : "funnel_ok",
          message: `Funnel ${funnelStep}${result.duplicate ? " (duplicado 24h)" : ""}`,
          payload: {
            funnel_step: funnelStep,
            click_id: clickId,
            recorded: result.recorded,
            duplicate: result.duplicate,
            event_id: result.eventId,
          } as Prisma.InputJsonValue,
        },
      });
      return res.status(200).json({
        ok: true,
        ignored: false,
        funnel_step: funnelStep,
        recorded: result.recorded,
        duplicate: result.duplicate,
        event_id: result.eventId,
      });
    }

    if (parsed.outcome.kind === "ignore") {
      await systemPrisma.postbackLog.create({
        data: {
          userId: user.id,
          platform,
          status: "rejected",
          message: parsed.outcome.reason,
          payload: {
            platform,
            conversion: "ignored",
            reason: parsed.outcome.reason,
            click_id: clickId,
            external_order_id: externalOrderId,
            flat,
          } as Prisma.InputJsonValue,
        },
      });
      return res.status(200).json({
        ok: true,
        ignored: true,
        conversion: "ignored",
        reason: parsed.outcome.reason,
      });
    }

    type ConversionResult =
      | "created"
      | "created_unattributed"
      | "duplicate"
      | "pending"
      | "pending_updated"
      | "approved_from_pending"
      | "restated"
      | "refunded"
      | "already_refunded"
      | "refund_not_found"
      | "refund_ambiguous"
      | "skipped_not_approved"
      | "skipped_no_click_id"
      | "invalid_click";

    let conversionResult: ConversionResult = "skipped_no_click_id";
    let presellPageId: string | null = null;
    let createdConversionId: string | null = null;
    let attribution: "attributed" | "unattributed" | null = null;
    let unattributedReason: string | null = null;

    const baseMeta = {
      ...flat,
      platform,
      postback_status: statusRaw,
      network_order_id: parsed.networkOrderId,
    };

    async function resolveClickAttribution(): Promise<{
      clickId?: string | null;
      presellId?: string | null;
      campaign?: string | null;
      attribution: "attributed" | "unattributed";
      reason?: string;
    }> {
      if (!clickId) {
        return { attribution: "unattributed", reason: "missing_click_id" };
      }
      const click = await systemPrisma.trackingEvent.findFirst({
        where: { id: clickId, userId: user!.id, eventType: "click" },
      });
      if (!click?.presellPageId) {
        return {
          attribution: "unattributed",
          reason: click ? "click_without_presell" : "click_id_not_found",
        };
      }
      return {
        clickId,
        presellId: click.presellPageId,
        campaign: click.campaign,
        attribution: "attributed",
      };
    }

    /** Refund/chargeback: reverte receita da encomenda existente (não cria venda fantasma). */
    async function applyRefund(): Promise<
      "refunded" | "already_refunded" | "refund_not_found" | "restated" | "refund_ambiguous"
    > {
      const orderKey = parsed.networkOrderId;
      const remember = (row: { id: string; attribution: string | null; presellId: string | null }) => {
        createdConversionId = row.id;
        attribution = row.attribution === "unattributed" ? "unattributed" : "attributed";
        presellPageId = row.presellId;
      };
      const textField = (key: string) => {
        const value = flat[key]?.trim();
        return value || null;
      };
      const orderMatch = orderKey
        ? [
            { externalOrderId: orderKey },
            { metadata: { path: ["network_order_id"], equals: orderKey } },
          ]
        : [];

      if (externalOrderId) {
        const priorTxn = await systemPrisma.conversion.findFirst({
          where: {
            userId: user!.id,
            metadata: { path: ["refund_transaction_ids"], array_contains: externalOrderId },
          },
        });
        if (priorTxn) {
          remember(priorTxn);
          return "already_refunded";
        }
      }

      const parentTxn = textField("parent_transaction_id");
      const paymentId = textField("payment_id");
      const sequence = textField("pay_sequence_no");

      let existing = parentTxn
        ? await systemPrisma.conversion.findUnique({
            where: { userId_externalOrderId: { userId: user!.id, externalOrderId: parentTxn } },
          })
        : null;
      if (!existing && paymentId) {
        existing = await systemPrisma.conversion.findFirst({
          where: {
            userId: user!.id,
            metadata: { path: ["payment_id"], equals: paymentId },
          },
          orderBy: { createdAt: "desc" },
        });
      }
      if (!existing && externalOrderId) {
        existing = await systemPrisma.conversion.findUnique({
          where: { userId_externalOrderId: { userId: user!.id, externalOrderId } },
        });
      }
      if (!existing && orderKey && sequence && sequence !== "0") {
        const sequenced = await systemPrisma.conversion.findMany({
          where: {
            userId: user!.id,
            AND: [
              { OR: orderMatch },
              { metadata: { path: ["pay_sequence_no"], equals: sequence } },
            ],
          },
          orderBy: { createdAt: "desc" },
        });
        const open = sequenced.filter((row) => row.status === "approved" || row.status === "pending");
        if (open.length === 1) existing = open[0];
        else if (open.length > 1) return "refund_ambiguous";
        else if (sequenced.some((row) => row.status === "refunded")) {
          remember(sequenced.find((row) => row.status === "refunded")!);
          return "already_refunded";
        }
      }
      if (!existing && orderKey) {
        const open = await systemPrisma.conversion.findMany({
          where: {
            userId: user!.id,
            status: { in: ["approved", "pending"] },
            OR: orderMatch,
          },
          orderBy: { createdAt: "desc" },
        });
        if (open.length === 1) existing = open[0];
        else if (open.length > 1) return "refund_ambiguous";
        else {
          const priorRefund = await systemPrisma.conversion.findFirst({
            where: {
              userId: user!.id,
              status: "refunded",
              OR: orderMatch,
            },
            orderBy: { createdAt: "desc" },
          });
          if (priorRefund) {
            remember(priorRefund);
            return "already_refunded";
          }
        }
      }
      if (!existing) return "refund_not_found";
      if (existing.status === "refunded" || (externalOrderId && refundTransactionIds(existing.metadata).includes(externalOrderId))) {
        remember(existing);
        return "already_refunded";
      }
      const refundKind = parsed.outcome.kind === "chargeback" ? "chargeback" : "refund";
      const adjustment = classifyRefundAdjustment({
        kind: refundKind,
        existingAmount: existing.amount != null ? Number(existing.amount) : null,
        refundAmount: amount != null ? Number(amount) : null,
      });
      if (adjustment === "partial" && existing.status === "approved" && amount != null && existing.amount != null) {
        const prev = Number(existing.amount);
        const next = prev - Number(amount);
        await systemPrisma.conversion.update({
          where: { id: existing.id },
          data: {
            amount: new Prisma.Decimal(next),
            metadata: metadataWithRefundTxn(
              existing.metadata,
              {
                ...baseMeta,
                partial_refund_at: new Date().toISOString(),
                partial_refund_amount: amount.toString(),
                previous_amount: prev,
              },
              externalOrderId,
            ) as Prisma.InputJsonValue,
          },
        });
        remember(existing);
        const partialAmount = Number(amount);
        void restateConversionToGoogleAds(existing.id).catch((err) =>
          console.error("[restateConversionToGoogleAds]", err),
        );
        void reportPartialRefundToMetaCapi(existing.id, partialAmount, externalOrderId).catch((err) =>
          console.error("[reportPartialRefundToMetaCapi]", err),
        );
        void reportPartialRefundToTikTokEvents(existing.id, partialAmount, externalOrderId).catch((err) =>
          console.error("[reportPartialRefundToTikTokEvents]", err),
        );
        return "restated";
      }
      /** Pending cancelado sem ter contado receita — só marca refunded. */
      if (existing.status === "pending") {
        await systemPrisma.conversion.update({
          where: { id: existing.id },
          data: {
            status: "refunded",
            metadata: metadataWithRefundTxn(
              existing.metadata,
              {
                ...baseMeta,
                refunded_at: new Date().toISOString(),
              },
              externalOrderId,
            ) as Prisma.InputJsonValue,
          },
        });
        remember(existing);
        return "refunded";
      }
      if (existing.status !== "approved") {
        return "refund_not_found";
      }

      const ops: Prisma.PrismaPromise<unknown>[] = [
        systemPrisma.conversion.update({
          where: { id: existing.id },
          data: {
            status: "refunded",
            metadata: metadataWithRefundTxn(
              existing.metadata,
              {
                ...baseMeta,
                refunded_at: new Date().toISOString(),
                refund_kind: refundKind,
                refund_amount: amount != null ? amount.toString() : null,
              },
              externalOrderId,
            ) as Prisma.InputJsonValue,
          },
        }),
      ];
      if (existing.presellId && existing.attribution === "attributed") {
        ops.push(
          systemPrisma.presellPage.update({
            where: { id: existing.presellId },
            data: { conversions: { decrement: 1 } },
          }),
        );
      }
      await systemPrisma.$transaction(ops);
      createdConversionId = existing.id;
      attribution = existing.attribution === "unattributed" ? "unattributed" : "attributed";
      presellPageId = existing.presellId;
      void retractConversionFromGoogleAds(existing.id).catch((err) =>
        console.error("[retractConversionFromGoogleAds]", err),
      );
      void retractConversionFromMetaCapi(existing.id).catch((err) =>
        console.error("[retractConversionFromMetaCapi]", err),
      );
      void retractConversionFromTikTokEvents(existing.id).catch((err) =>
        console.error("[retractConversionFromTikTokEvents]", err),
      );
      return "refunded";
    }

    async function createConversion(
      data: {
        clickId?: string | null;
        presellId?: string | null;
        campaign?: string | null;
        attribution: "attributed" | "unattributed";
        reason?: string;
      },
      status: "approved" | "pending" = "approved",
    ): Promise<"created" | "created_unattributed" | "pending" | "duplicate"> {
      const metadata = {
        ...baseMeta,
        attribution: data.attribution,
        ...(data.reason ? { unattributed_reason: data.reason } : {}),
      } as Prisma.InputJsonValue;

      try {
        const ops: Prisma.PrismaPromise<unknown>[] = [
          systemPrisma.conversion.create({
            data: {
              clickId: data.clickId ?? null,
              userId: user!.id,
              presellId: data.presellId ?? null,
              campaign: data.campaign ?? undefined,
              amount: amount ?? undefined,
              currency,
              status,
              attribution: data.attribution,
              externalOrderId: externalOrderId ?? undefined,
              metadata,
            },
          }),
        ];
        if (status === "approved" && data.presellId && data.attribution === "attributed") {
          ops.push(
            systemPrisma.presellPage.update({
              where: { id: data.presellId },
              data: { conversions: { increment: 1 } },
            }),
          );
        }
        const [createdConv] = (await systemPrisma.$transaction(ops)) as [
          { id: string },
          ...unknown[],
        ];
        createdConversionId = createdConv.id;
        attribution = data.attribution;
        if (data.presellId) presellPageId = data.presellId;
        if (status === "pending") return "pending";
        if (data.attribution === "attributed") {
          void syncConversionToGoogleAds(createdConv.id).catch((err) =>
            console.error("[syncConversionToGoogleAds]", err),
          );
          void syncConversionToMetaCapi(createdConv.id).catch((err) =>
            console.error("[syncConversionToMetaCapi]", err),
          );
          void syncConversionToTikTokEvents(createdConv.id).catch((err) =>
            console.error("[syncConversionToTikTokEvents]", err),
          );
          return "created";
        }
        return "created_unattributed";
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return "duplicate";
        }
        throw e;
      }
    }

    /** Pending → approved, ou ajuste de valor (RESTATEMENT). */
    async function upgradeOrRestateExisting(): Promise<ConversionResult | null> {
      if (!externalOrderId) return null;
      const existing = await systemPrisma.conversion.findUnique({
        where: {
          userId_externalOrderId: { userId: user!.id, externalOrderId },
        },
      });
      if (!existing) return null;

      if (existing.status === "pending" && approved) {
        const ops: Prisma.PrismaPromise<unknown>[] = [
          systemPrisma.conversion.update({
            where: { id: existing.id },
            data: {
              status: "approved",
              amount: amount ?? existing.amount,
              currency: currency ?? existing.currency,
              metadata: {
                ...(typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
                  ? (existing.metadata as Record<string, unknown>)
                  : {}),
                ...baseMeta,
                approved_from_pending_at: new Date().toISOString(),
              } as Prisma.InputJsonValue,
            },
          }),
        ];
        if (existing.presellId && existing.attribution === "attributed") {
          ops.push(
            systemPrisma.presellPage.update({
              where: { id: existing.presellId },
              data: { conversions: { increment: 1 } },
            }),
          );
        }
        await systemPrisma.$transaction(ops);
        createdConversionId = existing.id;
        attribution = existing.attribution === "unattributed" ? "unattributed" : "attributed";
        presellPageId = existing.presellId;
        if (existing.attribution === "attributed") {
          void syncConversionToGoogleAds(existing.id).catch((err) =>
            console.error("[syncConversionToGoogleAds]", err),
          );
          void syncConversionToMetaCapi(existing.id).catch((err) =>
            console.error("[syncConversionToMetaCapi]", err),
          );
          void syncConversionToTikTokEvents(existing.id).catch((err) =>
            console.error("[syncConversionToTikTokEvents]", err),
          );
        }
        return "approved_from_pending";
      }

      if (existing.status === "approved" && approved && amount != null) {
        const prev = existing.amount != null ? Number(existing.amount) : null;
        if (prev != null && Math.abs(prev - Number(amount)) >= 0.01) {
          await systemPrisma.conversion.update({
            where: { id: existing.id },
            data: {
              amount,
              currency: currency ?? existing.currency,
              metadata: {
                ...(typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
                  ? (existing.metadata as Record<string, unknown>)
                  : {}),
                ...baseMeta,
                restated_at: new Date().toISOString(),
                previous_amount: prev,
              } as Prisma.InputJsonValue,
            },
          });
          createdConversionId = existing.id;
          attribution = existing.attribution === "unattributed" ? "unattributed" : "attributed";
          presellPageId = existing.presellId;
          void restateConversionToGoogleAds(existing.id).catch((err) =>
            console.error("[restateConversionToGoogleAds]", err),
          );
          return "restated";
        }
      }

      if (existing.status === "pending" && parsed.outcome.kind === "pending") {
        await systemPrisma.conversion.update({
          where: { id: existing.id },
          data: {
            amount: amount ?? existing.amount,
            currency: currency ?? existing.currency,
            metadata: {
              ...(typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
                ? (existing.metadata as Record<string, unknown>)
                : {}),
              ...baseMeta,
            } as Prisma.InputJsonValue,
          },
        });
        createdConversionId = existing.id;
        attribution = existing.attribution === "unattributed" ? "unattributed" : "attributed";
        presellPageId = existing.presellId;
        return "pending_updated";
      }

      if (existing.status === "approved" || existing.status === "pending") {
        createdConversionId = existing.id;
        attribution = existing.attribution === "unattributed" ? "unattributed" : "attributed";
        presellPageId = existing.presellId;
        return "duplicate";
      }
      return null;
    }

    if (parsed.outcome.kind === "refund" || parsed.outcome.kind === "chargeback") {
      conversionResult = await applyRefund();
    } else {
      const upgraded = await upgradeOrRestateExisting();
      if (upgraded) {
        conversionResult = upgraded;
      } else if (approved) {
        const attr = await resolveClickAttribution();
        if (attr.reason) unattributedReason = attr.reason;
        conversionResult = await createConversion(attr, "approved");
      } else if (parsed.outcome.kind === "pending") {
        const attr = await resolveClickAttribution();
        if (attr.reason) unattributedReason = attr.reason;
        conversionResult = await createConversion(attr, "pending");
      } else {
        conversionResult = "skipped_not_approved";
      }
    }

    const payloadLog = {
      platform,
      conversion: conversionResult,
      attribution: attribution,
      unattributed_reason: unattributedReason,
      click_id: clickId,
      external_order_id: externalOrderId,
      amount: amount != null ? amount.toString() : null,
      currency,
      status_raw: statusRaw,
      flat,
      received_at: new Date().toISOString(),
    };

    let mail: { sent: boolean; reason?: string } = { sent: false, reason: "skipped_not_sale" };
    if (isApprovedSaleNotice(conversionResult) && createdConversionId) {
      mail = await notifyApprovedSale({
        userId: user.id,
        conversionId: createdConversionId,
        platform,
        amount: amount != null ? amount.toString() : null,
        currency: currency ?? null,
        orderId: externalOrderId ?? null,
        linkedToClick: attribution === "attributed",
      });
    }

    const logStatus =
      conversionResult === "created" ||
      conversionResult === "created_unattributed" ||
      conversionResult === "duplicate" ||
      conversionResult === "pending" ||
      conversionResult === "pending_updated" ||
      conversionResult === "approved_from_pending" ||
      conversionResult === "restated" ||
      conversionResult === "refunded" ||
      conversionResult === "already_refunded"
        ? "success"
          : conversionResult === "skipped_not_approved" ||
              conversionResult === "refund_not_found" ||
              conversionResult === "refund_ambiguous"
          ? "rejected"
          : "info";

    await systemPrisma.postbackLog.create({
      data: {
        userId: user.id,
        presellPageId,
        platform,
        status: logStatus,
        message: unattributedReason
          ? `${conversionResult}:${unattributedReason}`
          : conversionResult,
        payload: payloadLog as Prisma.InputJsonValue,
      },
    });

    return res.status(200).json({
      ok: true,
      conversion: conversionResult,
      attribution: attribution,
      ...(unattributedReason ? { unattributed_reason: unattributedReason } : {}),
      ...(createdConversionId ? { conversion_id: createdConversionId } : {}),
      google_ads_sync_queued:
        conversionResult === "created" || conversionResult === "approved_from_pending",
      google_ads_retraction_queued: conversionResult === "refunded",
      google_ads_restatement_queued: conversionResult === "restated",
      email_sent: mail.sent,
      ...(!mail.sent ? { email_note: mail.reason } : {}),
    });
  },

  /** Envia e-mail de teste para o destino configurado (autenticado). */
  async testSaleNotificationEmail(req: Request, res: Response) {
    const userId = billingUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, saleNotifyEmail: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    if (!isTransactionalEmailConfigured()) {
      return res.status(503).json({
        error:
          "SMTP não configurado no servidor. Defina SMTP_FROM e (SMTP_HOST ou RESEND_API_KEY) na API.",
      });
    }

    const to = (user.saleNotifyEmail?.trim() || user.email).trim();
    const subject = "[dclickora] Teste de notificação de venda (webhook de afiliados)";
    const text =
      "Este e-mail confirma que os alertas de venda da dclickora chegam a esta caixa.\n\n" +
      "Quando a rede aprovar uma venda no postback, o resumo chega aqui mesmo com a dclickora e o Google fechados.\n" +
      "O aviso no telemóvel ou no computador é outro canal: activa-se uma vez em Integrações, nesse aparelho.\n";

    const mail = await sendTransactionalEmail({ to, subject, text });
    if (!mail.sent) {
      return res.status(503).json({ error: (mail as { reason: string }).reason });
    }

    await prisma.postbackLog.create({
      data: {
        userId,
        platform: "affiliate_webhook_test",
        status: "success",
        message: `E-mail de teste enviado para ${to}`,
        payload: {} as Prisma.InputJsonValue,
      },
    });

    return res.json({ ok: true, sent_to: to });
  },

  /**
   * Simula um postback da rede (BuyGoods/SmartAdv/…) com o último clique da conta.
   * Não substitui um teste real na rede, mas confirma que o webhook + atribuição funcionam.
   */
  async testAffiliatePostback(req: Request, res: Response) {
    const userId = billingUserId(req);
    const sub = await subscriptionPlanForWebhookGate(userId);
    if (!planAllowsAffiliateWebhook(sub?.plan)) {
      return res.status(403).json({
        error: "Webhook de afiliados não está activo no seu plano.",
        code: "AFFILIATE_WEBHOOK_PLAN",
      });
    }

    const platformRaw =
      typeof req.body?.platform === "string" && req.body.platform.trim()
        ? req.body.platform.trim()
        : "BuyGoods";
    const platform = platformRaw.slice(0, 64);

    const lastClick = await systemPrisma.trackingEvent.findFirst({
      where: { userId, eventType: "click" },
      orderBy: { createdAt: "desc" },
      select: { id: true, campaign: true, presellPageId: true, createdAt: true },
    });
    if (!lastClick) {
      return res.status(400).json({
        ok: false,
        code: "NO_CLICK",
        error:
          "Ainda não há cliques nesta conta. Abra o URL da campanha (ou a presell) no browser, clique no botão da oferta e volte a testar.",
        next_step: "Abrir link da campanha → clicar CTA → Testar ligação",
      });
    }

    const token = createPostbackToken(userId);
    if (!token) {
      return res.status(503).json({ error: "JWT_SECRET não configurado no servidor." });
    }
    const base = publicApiBaseFromRequest(req).replace(/\/+$/, "");
    const orderId = `clickora-test-${Date.now()}`;
    const u = new URL(`${base}/integrations/affiliate-webhook`);
    u.searchParams.set("token", token);
    for (const [key, value] of Object.entries(buildTestSaleQuery(platform, lastClick.id, orderId))) {
      u.searchParams.set(key, value);
    }

    let webhookBody: Record<string, unknown> = {};
    let httpStatus = 0;
    try {
      const r = await fetch(u.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(25_000),
      });
      httpStatus = r.status;
      webhookBody = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha de rede ao chamar o webhook";
      return res.status(503).json({
        ok: false,
        code: "WEBHOOK_UNREACHABLE",
        error: `Não foi possível chamar o webhook: ${msg}`,
        click_id: lastClick.id,
      });
    }

    const conversion = typeof webhookBody.conversion === "string" ? webhookBody.conversion : null;
    const attribution = typeof webhookBody.attribution === "string" ? webhookBody.attribution : null;
    const ok =
      httpStatus === 200 &&
      (conversion === "created" || conversion === "created_unattributed" || conversion === "duplicate");

    return res.status(ok ? 200 : 502).json({
      ok,
      platform,
      http_status: httpStatus,
      conversion,
      attribution,
      unattributed_reason: webhookBody.unattributed_reason ?? null,
      conversion_id: webhookBody.conversion_id ?? null,
      click_id: lastClick.id,
      click_campaign: lastClick.campaign,
      click_at: lastClick.createdAt.toISOString(),
      order_id: orderId,
      message:
        conversion === "created"
          ? "Ligação OK: venda de teste atribuída ao último clique. Veja Resultados → Conversões."
          : conversion === "created_unattributed"
            ? "Webhook OK, mas a venda ficou sem atribuição (ID de clique não bateu). Confirme o hoplink e o postback na rede."
            : conversion === "duplicate"
              ? "Já existia conversão com este order id de teste — webhook respondeu bem."
              : "O webhook não criou conversão. Veja o detalhe abaixo ou Configurações → Logs.",
      webhook: webhookBody,
    });
  },

  /** Estado da integração Google Ads (offline conversions). */
  async getGoogleAdsSettings(req: Request, res: Response) {
    const userId = billingUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleAdsEnabled: true,
        googleAdsCustomerId: true,
        googleAdsConversionActionId: true,
        googleAdsLoginCustomerId: true,
        googleAdsRefreshToken: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const envOk = Boolean(getGoogleAdsApiClientConfigFromEnv());
    const hasUserRefresh = Boolean(user.googleAdsRefreshToken?.trim());
    const hasEnvRefresh = Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim());

    res.json({
      google_ads_enabled: user.googleAdsEnabled,
      google_ads_customer_id: user.googleAdsCustomerId ?? "",
      google_ads_conversion_action_id: user.googleAdsConversionActionId ?? "",
      google_ads_login_customer_id: user.googleAdsLoginCustomerId ?? "",
      has_refresh_token: hasUserRefresh || hasEnvRefresh,
      api_env_configured: envOk,
      can_upload: isGoogleAdsClickUploadReadyForUser(user),
    });
  },

  async patchGoogleAdsSettings(req: Request, res: Response) {
    const schema = z.object({
      google_ads_enabled: z.boolean().optional(),
      google_ads_customer_id: z.string().optional(),
      google_ads_conversion_action_id: z.string().optional(),
      google_ads_login_customer_id: z.string().optional(),
      google_ads_refresh_token: z.string().optional(),
      clear_google_ads_refresh_token: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const userId = billingUserId(req);
    const d = parsed.data;
    const data: {
      googleAdsEnabled?: boolean;
      googleAdsCustomerId?: string | null;
      googleAdsConversionActionId?: string | null;
      googleAdsLoginCustomerId?: string | null;
      googleAdsRefreshToken?: string | null;
    } = {};

    if (d.google_ads_enabled !== undefined) data.googleAdsEnabled = d.google_ads_enabled;
    if (d.google_ads_customer_id !== undefined) {
      const digits = onlyDigits(d.google_ads_customer_id);
      data.googleAdsCustomerId = digits;
    }
    if (d.google_ads_conversion_action_id !== undefined) {
      const t = d.google_ads_conversion_action_id.trim();
      data.googleAdsConversionActionId = t || null;
    }
    if (d.google_ads_login_customer_id !== undefined) {
      const digits = onlyDigits(d.google_ads_login_customer_id);
      data.googleAdsLoginCustomerId = digits;
    }
    if (d.clear_google_ads_refresh_token) data.googleAdsRefreshToken = null;
    else if (d.google_ads_refresh_token !== undefined && d.google_ads_refresh_token.trim()) {
      data.googleAdsRefreshToken = encryptSecretField(d.google_ads_refresh_token.trim());
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleAdsEnabled: true,
        googleAdsCustomerId: true,
        googleAdsConversionActionId: true,
        googleAdsLoginCustomerId: true,
        googleAdsRefreshToken: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const envOk = Boolean(getGoogleAdsApiClientConfigFromEnv());
    const hasUserRefresh = Boolean(user.googleAdsRefreshToken?.trim());
    const hasEnvRefresh = Boolean(process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim());

    res.json({
      ok: true,
      google_ads_enabled: user.googleAdsEnabled,
      google_ads_customer_id: user.googleAdsCustomerId ?? "",
      google_ads_conversion_action_id: user.googleAdsConversionActionId ?? "",
      google_ads_login_customer_id: user.googleAdsLoginCustomerId ?? "",
      has_refresh_token: hasUserRefresh || hasEnvRefresh,
      api_env_configured: envOk,
      can_upload: isGoogleAdsClickUploadReadyForUser(user),
    });
  },

  /**
   * Inicia OAuth Google Ads (multi-tenant: cada utilizador guarda o seu refresh token).
   * Resposta: URL para redirecionar o browser (conta Google do anunciante).
   */
  async beginGoogleAdsOAuth(req: Request, res: Response) {
    if (!getGoogleAdsApiClientConfigFromEnv()) {
      return res.status(503).json({
        error:
          "Credenciais Google Ads API em falta no servidor (GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET).",
      });
    }
    if (!process.env.JWT_SECRET?.trim()) {
      return res.status(503).json({ error: "JWT_SECRET em falta no servidor." });
    }
    try {
      const state = signGoogleAdsOAuthState(billingUserId(req));
      const { authorizeUrl } = buildGoogleAdsAuthorizeUrl(state);
      return res.json({ authorize_url: authorizeUrl });
    } catch (e) {
      console.error("[beginGoogleAdsOAuth]", e);
      return res.status(500).json({
        error:
          e instanceof Error
            ? e.message
            : "Falha ao construir o URL de autorização. Confirme API_PUBLIC_URL ou GOOGLE_ADS_OAUTH_REDIRECT_URI.",
      });
    }
  },

  /**
   * Callback público OAuth: troca o código por refresh token e grava só no utilizador do `state` assinado.
   */
  async googleAdsOAuthCallback(req: Request, res: Response) {
    const frontend = getPrimaryFrontendOrigin();
    const setupUrl = `${frontend}/integracoes/google-ads`;
    const redirectFail = (reason: string) =>
      res.redirect(`${setupUrl}?google_ads_oauth=error&reason=${encodeURIComponent(reason)}`);
    const redirectOk = (extra = "") =>
      res.redirect(`${setupUrl}?google_ads_oauth=success${extra}`);

    const oauthErr = req.query.error?.toString();
    if (oauthErr) return redirectFail(oauthErr);

    const code = req.query.code?.toString();
    const state = req.query.state?.toString();
    if (!code || !state) return redirectFail("missing_code_or_state");

    const decoded = verifyGoogleAdsOAuthState(state);
    if (!decoded) return redirectFail("invalid_or_expired_state");

    const result = await exchangeGoogleAdsAuthorizationCode(code);
    if (result.error || !result.refresh_token) {
      return redirectFail(result.error || "exchange_failed");
    }

    await systemPrisma.user.update({
      where: { id: decoded.userId },
      data: { googleAdsRefreshToken: encryptSecretField(result.refresh_token) },
    });

    /** Auto: conta + ação GCLID + upload ON; sync custos em background. */
    let bootDetail = "";
    try {
      const boot = await bootstrapGoogleAdsAfterOAuth(decoded.userId);
      bootDetail = boot.ok
        ? `&boot=ok&customer=${encodeURIComponent(boot.customer_id || "")}`
        : `&boot=partial&boot_detail=${encodeURIComponent(boot.detail.slice(0, 180))}`;
      if (boot.ok) {
        void syncAdCostsForUser(decoded.userId, 14).catch((e) =>
          console.warn("[googleAdsOAuthCallback] cost sync", e),
        );
      }
    } catch (e) {
      console.warn("[googleAdsOAuthCallback] bootstrap", e);
      bootDetail = `&boot=error`;
    }

    return redirectOk(bootDetail);
  },

  /** Re-executa bootstrap (escolher conta / criar ação) sem novo OAuth. */
  async bootstrapGoogleAds(req: Request, res: Response) {
    if (!getGoogleAdsApiClientConfigFromEnv()) {
      return res.status(503).json({ error: "Google Ads API não configurada no servidor." });
    }
    const userId = billingUserId(req);
    try {
      const boot = await bootstrapGoogleAdsAfterOAuth(userId);
      if (boot.ok) {
        void syncAdCostsForUser(userId, 14).catch((e) => console.warn("[bootstrapGoogleAds] cost sync", e));
      }
      return res.status(boot.ok ? 200 : 422).json(boot.ok ? boot : { ...boot, error: boot.detail });
    } catch (e) {
      console.error("[bootstrapGoogleAds]", e);
      return res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Falha no bootstrap Google Ads",
      });
    }
  },

  /** Meta Conversions API (Pixel server-side). */
  async getMetaCapiSettings(req: Request, res: Response) {
    const userId = billingUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        metaCapiEnabled: true,
        metaPixelId: true,
        metaAccessToken: true,
        metaCapiTestEventCode: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    res.json({
      meta_capi_enabled: user.metaCapiEnabled,
      meta_pixel_id: user.metaPixelId ?? "",
      has_access_token: Boolean(user.metaAccessToken?.trim()),
      meta_capi_test_event_code: user.metaCapiTestEventCode ?? "",
      can_send: isMetaCapiReadyForUser(user),
    });
  },

  async patchMetaCapiSettings(req: Request, res: Response) {
    const schema = z.object({
      meta_capi_enabled: z.boolean().optional(),
      meta_pixel_id: z.string().optional(),
      meta_access_token: z.string().optional(),
      meta_capi_test_event_code: z.string().optional(),
      clear_meta_access_token: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const userId = billingUserId(req);
    const d = parsed.data;
    const data: {
      metaCapiEnabled?: boolean;
      metaPixelId?: string | null;
      metaAccessToken?: string | null;
      metaCapiTestEventCode?: string | null;
    } = {};

    if (d.meta_capi_enabled !== undefined) data.metaCapiEnabled = d.meta_capi_enabled;
    if (d.meta_pixel_id !== undefined) {
      const t = d.meta_pixel_id.replace(/\D/g, "");
      data.metaPixelId = t || null;
    }
    if (d.clear_meta_access_token) data.metaAccessToken = null;
    else if (d.meta_access_token !== undefined && d.meta_access_token.trim()) {
      data.metaAccessToken = encryptSecretField(d.meta_access_token.trim());
    }
    if (d.meta_capi_test_event_code !== undefined) {
      const c = d.meta_capi_test_event_code.trim();
      data.metaCapiTestEventCode = c || null;
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        metaCapiEnabled: true,
        metaPixelId: true,
        metaAccessToken: true,
        metaCapiTestEventCode: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    res.json({
      ok: true,
      meta_capi_enabled: user.metaCapiEnabled,
      meta_pixel_id: user.metaPixelId ?? "",
      has_access_token: Boolean(user.metaAccessToken?.trim()),
      meta_capi_test_event_code: user.metaCapiTestEventCode ?? "",
      can_send: isMetaCapiReadyForUser(user),
    });
  },

  /** TikTok Events API (Pixel server-side, requer ttclid no clique). */
  async getTiktokEventsSettings(req: Request, res: Response) {
    const userId = billingUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tiktokEventsEnabled: true,
        tiktokPixelId: true,
        tiktokEventsAccessToken: true,
        tiktokEventsTestEventCode: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    res.json({
      tiktok_events_enabled: user.tiktokEventsEnabled,
      tiktok_pixel_id: user.tiktokPixelId ?? "",
      has_access_token: Boolean(user.tiktokEventsAccessToken?.trim()),
      tiktok_events_test_event_code: user.tiktokEventsTestEventCode ?? "",
      can_send: isTikTokEventsReadyForUser(user),
    });
  },

  async patchTiktokEventsSettings(req: Request, res: Response) {
    const schema = z.object({
      tiktok_events_enabled: z.boolean().optional(),
      tiktok_pixel_id: z.string().optional(),
      tiktok_events_access_token: z.string().optional(),
      tiktok_events_test_event_code: z.string().optional(),
      clear_tiktok_events_access_token: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const userId = billingUserId(req);
    const d = parsed.data;
    const data: {
      tiktokEventsEnabled?: boolean;
      tiktokPixelId?: string | null;
      tiktokEventsAccessToken?: string | null;
      tiktokEventsTestEventCode?: string | null;
    } = {};

    if (d.tiktok_events_enabled !== undefined) data.tiktokEventsEnabled = d.tiktok_events_enabled;
    if (d.tiktok_pixel_id !== undefined) {
      const t = d.tiktok_pixel_id.trim();
      data.tiktokPixelId = t || null;
    }
    if (d.clear_tiktok_events_access_token) data.tiktokEventsAccessToken = null;
    else if (d.tiktok_events_access_token !== undefined && d.tiktok_events_access_token.trim()) {
      data.tiktokEventsAccessToken = encryptSecretField(d.tiktok_events_access_token.trim());
    }
    if (d.tiktok_events_test_event_code !== undefined) {
      const c = d.tiktok_events_test_event_code.trim();
      data.tiktokEventsTestEventCode = c || null;
    }

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tiktokEventsEnabled: true,
        tiktokPixelId: true,
        tiktokEventsAccessToken: true,
        tiktokEventsTestEventCode: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    res.json({
      ok: true,
      tiktok_events_enabled: user.tiktokEventsEnabled,
      tiktok_pixel_id: user.tiktokPixelId ?? "",
      has_access_token: Boolean(user.tiktokEventsAccessToken?.trim()),
      tiktok_events_test_event_code: user.tiktokEventsTestEventCode ?? "",
      can_send: isTikTokEventsReadyForUser(user),
    });
  },

  /** Segredos de postback. A leitura nunca devolve o valor, só se está guardado. */
  async getAffiliateSecrets(req: Request, res: Response) {
    const user = await prisma.user.findUnique({
      where: { id: billingUserId(req) },
      select: { jvzooIpnSecret: true, clickbankInsSecret: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });
    res.json({
      has_jvzoo_ipn_secret: Boolean(decryptSecretField(user.jvzooIpnSecret)),
      has_clickbank_ins_secret: Boolean(decryptSecretField(user.clickbankInsSecret)),
    });
  },

  async patchAffiliateSecrets(req: Request, res: Response) {
    const schema = z.object({
      jvzoo_ipn_secret: z.string().max(200).optional(),
      clickbank_ins_secret: z.string().max(16).optional(),
      clear_jvzoo_ipn_secret: z.boolean().optional(),
      clear_clickbank_ins_secret: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const d = parsed.data;
    const data: { jvzooIpnSecret?: string | null; clickbankInsSecret?: string | null } = {};
    if (d.clear_jvzoo_ipn_secret) data.jvzooIpnSecret = null;
    else if (d.jvzoo_ipn_secret?.trim()) data.jvzooIpnSecret = encryptSecretField(d.jvzoo_ipn_secret.trim());
    if (d.clear_clickbank_ins_secret) data.clickbankInsSecret = null;
    else if (d.clickbank_ins_secret?.trim()) {
      data.clickbankInsSecret = encryptSecretField(d.clickbank_ins_secret.trim().slice(0, 16));
    }
    const userId = billingUserId(req);
    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { jvzooIpnSecret: true, clickbankInsSecret: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });
    res.json({
      ok: true,
      has_jvzoo_ipn_secret: Boolean(decryptSecretField(user.jvzooIpnSecret)),
      has_clickbank_ins_secret: Boolean(decryptSecretField(user.clickbankInsSecret)),
    });
  },

  async patchNotificationEmail(req: Request, res: Response) {
    const parsed = profileNotifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const raw = parsed.data.sale_notify_email;
    const value = raw === "" || raw === undefined ? null : raw;

    await prisma.user.update({
      where: { id: billingUserId(req) },
      data: { saleNotifyEmail: value },
    });

    return res.json({ ok: true, sale_notify_email: value ?? "" });
  },

  async getTelegramSettings(req: Request, res: Response) {
    const userId = billingUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        telegramBotToken: true,
        telegramNotifySale: true,
        telegramNotifyPostbackError: true,
        telegramNotifyClick: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const hasToken = Boolean(user.telegramBotToken?.trim());
    const hasChat = Boolean(user.telegramChatId?.trim());

    res.json({
      telegram_chat_id: user.telegramChatId ?? "",
      telegram_configured: hasToken && hasChat,
      has_bot_token: hasToken,
      telegram_notify_sale: user.telegramNotifySale,
      telegram_notify_postback_error: user.telegramNotifyPostbackError,
      telegram_notify_click: user.telegramNotifyClick,
    });
  },

  async patchTelegramSettings(req: Request, res: Response) {
    const schema = z.object({
      telegram_bot_token: z.string().optional(),
      clear_telegram_bot_token: z.boolean().optional(),
      telegram_chat_id: z.string().optional(),
      telegram_notify_sale: z.boolean().optional(),
      telegram_notify_postback_error: z.boolean().optional(),
      telegram_notify_click: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const userId = billingUserId(req);
    const d = parsed.data;
    const data: {
      telegramBotToken?: string | null;
      telegramChatId?: string | null;
      telegramNotifySale?: boolean;
      telegramNotifyPostbackError?: boolean;
      telegramNotifyClick?: boolean;
    } = {};

    if (d.clear_telegram_bot_token) data.telegramBotToken = null;
    else if (d.telegram_bot_token !== undefined && d.telegram_bot_token.trim()) {
      data.telegramBotToken = encryptSecretField(d.telegram_bot_token.trim());
    }

    if (d.telegram_chat_id !== undefined) {
      const t = d.telegram_chat_id.trim();
      data.telegramChatId = t || null;
    }
    if (d.telegram_notify_sale !== undefined) data.telegramNotifySale = d.telegram_notify_sale;
    if (d.telegram_notify_postback_error !== undefined) {
      data.telegramNotifyPostbackError = d.telegram_notify_postback_error;
    }
    if (d.telegram_notify_click !== undefined) data.telegramNotifyClick = d.telegram_notify_click;

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data });
    }

    const fresh = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        telegramBotToken: true,
        telegramNotifySale: true,
        telegramNotifyPostbackError: true,
        telegramNotifyClick: true,
      },
    });
    if (!fresh) return res.status(404).json({ error: "Utilizador não encontrado" });

    const hasToken = Boolean(fresh.telegramBotToken?.trim());
    const hasChat = Boolean(fresh.telegramChatId?.trim());

    return res.json({
      telegram_chat_id: fresh.telegramChatId ?? "",
      telegram_configured: hasToken && hasChat,
      has_bot_token: hasToken,
      telegram_notify_sale: fresh.telegramNotifySale,
      telegram_notify_postback_error: fresh.telegramNotifyPostbackError,
      telegram_notify_click: fresh.telegramNotifyClick,
    });
  },

  async testTelegramIntegration(req: Request, res: Response) {
    const userId = billingUserId(req);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramBotToken: true, telegramChatId: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const token = decryptSecretField(user.telegramBotToken)?.trim();
    const chat = user.telegramChatId?.trim();
    if (!token || !chat) {
      return res.status(400).json({
        error: "Configure o token do bot e o Chat ID antes de testar.",
      });
    }

    const r = await sendTelegram(
      token,
      chat,
      "Teste dclickora: a integração Telegram está a funcionar.",
    );
    if (!r.ok) {
      return res.status(502).json({ error: r.error });
    }

    return res.json({ ok: true });
  },

  /** Estado Web Push só para o tenant do JWT (nunca cruza contas). */
  async getWebPushConfig(req: Request, res: Response) {
    ensureWebPushFromEnv();
    const userId = actorUserId(req);
    const subscription_count = await systemPrisma.webPushSubscription.count({ where: { userId } });
    res.json({
      configured: isWebPushConfigured(),
      vapid_public_key: getVapidPublicKeyFromEnv(),
      subscription_count,
    });
  },

  /**
   * Subscreve o browser ao push do utilizador autenticado (`req.user.userId`).
   * Usa `systemPrisma` com `userId` explícito (o modelo não está no cliente tenant Prisma — endpoint é único global).
   * Se o mesmo endpoint existir para outro tenant, reatribui-se ao utilizador actual (troca de sessão no mesmo browser).
   */
  async subscribeWebPush(req: Request, res: Response) {
    const schema = z.object({
      subscription: z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
      user_agent: z.string().max(512).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    ensureWebPushFromEnv();
    if (!isWebPushConfigured()) {
      return res.status(503).json({
        error: "Web Push não está configurado no servidor. Defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.",
      });
    }

    const userId = actorUserId(req);
    const {
      subscription: { endpoint, keys },
      user_agent,
    } = parsed.data;
    const ua = user_agent?.trim() || null;

    await systemPrisma.$transaction(async (tx) => {
      const existing = await tx.webPushSubscription.findUnique({ where: { endpoint } });
      if (existing && existing.userId !== userId) {
        await tx.webPushSubscription.delete({ where: { id: existing.id } });
      }
      await tx.webPushSubscription.upsert({
        where: { endpoint },
        create: {
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: ua,
        },
        update: {
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: ua,
        },
      });
    });

    return res.json({ ok: true });
  },

  async unsubscribeWebPush(req: Request, res: Response) {
    const schema = z.object({ endpoint: z.string().url() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    /** Só remove linhas do tenant actual (JWT). */
    const result = await systemPrisma.webPushSubscription.deleteMany({
      where: { userId: actorUserId(req), endpoint: parsed.data.endpoint },
    });
    return res.json({ ok: true, removed: result.count });
  },

  async testWebPush(req: Request, res: Response) {
    ensureWebPushFromEnv();
    if (!isWebPushConfigured()) {
      return res.status(503).json({
        error: "Web Push não está configurado no servidor.",
      });
    }
    const userId = actorUserId(req);
    const count = await systemPrisma.webPushSubscription.count({ where: { userId } });
    if (count === 0) {
      return res.status(400).json({
        error: "Não há subscrições neste dispositivo. Ative as notificações primeiro.",
      });
    }
    await sendWebPushToUser(userId, {
      title: "Teste dclickora",
      body: "Se viu isto no telemóvel ou no computador, o Web Push está a funcionar.",
      url: "/tracking/integrations",
    });
    return res.json({ ok: true });
  },

  async listBlacklist(req: Request, res: Response) {
    const rows = await prisma.blacklistedIp.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        ip: r.ipAddress,
        reason: r.reason,
        added_at: r.createdAt.toISOString(),
      })),
    );
  },

  async addBlacklist(req: Request, res: Response) {
    const schema = z.object({
      ip: z.string().min(7),
      reason: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const ipNorm = parseIpv4Blacklist(parsed.data.ip);
    if (!ipNorm) {
      return res.status(400).json({ error: "Indique um IPv4 válido (ex.: 203.0.113.1)" });
    }
    const userId = billingUserId(req);
    await prisma.blacklistedIp.upsert({
      where: { userId_ipAddress: { userId, ipAddress: ipNorm } },
      create: {
        userId,
        ipAddress: ipNorm,
        reason: parsed.data.reason?.trim() || null,
      },
      update: { reason: parsed.data.reason?.trim() || null },
    });
    return res.json({ ok: true, ip: ipNorm });
  },

  async removeBlacklist(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID em falta" });
    /** `userId` explícito + extensão tenant: só remove linha do próprio tenant (nunca por `id` sozinho). */
    const result = await prisma.blacklistedIp.deleteMany({
      where: { id, userId: billingUserId(req) },
    });
    if (result.count === 0) return res.status(404).json({ error: "Entrada não encontrada" });
    return res.json({ ok: true });
  },

  async getTrackingGuards(req: Request, res: Response) {
    const userId = billingUserId(req);
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        blockEmptyUserAgent: true,
        blockBotClicks: true,
        blockProxyClicks: true,
        autoBlacklistClickThreshold: true,
        autoBlacklistClickWindowHours: true,
      },
    });
    if (!u) return res.status(404).json({ error: "Utilizador não encontrado" });
    res.json({
      block_empty_user_agent: u.blockEmptyUserAgent,
      block_bot_clicks: u.blockBotClicks,
      block_proxy_clicks: u.blockProxyClicks,
      auto_blacklist_click_threshold: u.autoBlacklistClickThreshold,
      auto_blacklist_click_window_hours: u.autoBlacklistClickWindowHours,
    });
  },

  async patchTrackingGuards(req: Request, res: Response) {
    const schema = z.object({
      block_empty_user_agent: z.boolean().optional(),
      block_bot_clicks: z.boolean().optional(),
      block_proxy_clicks: z.boolean().optional(),
      auto_blacklist_click_threshold: z.number().int().min(0).max(5000).optional(),
      auto_blacklist_click_window_hours: z.number().int().min(1).max(168).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const d = parsed.data;
    if (
      d.block_empty_user_agent === undefined &&
      d.block_bot_clicks === undefined &&
      d.block_proxy_clicks === undefined &&
      d.auto_blacklist_click_threshold === undefined &&
      d.auto_blacklist_click_window_hours === undefined
    ) {
      return res.status(400).json({ error: "Nenhum campo para atualizar" });
    }
    const userId = billingUserId(req);
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(d.block_empty_user_agent !== undefined ? { blockEmptyUserAgent: d.block_empty_user_agent } : {}),
        ...(d.block_bot_clicks !== undefined ? { blockBotClicks: d.block_bot_clicks } : {}),
        ...(d.block_proxy_clicks !== undefined ? { blockProxyClicks: d.block_proxy_clicks } : {}),
        ...(d.auto_blacklist_click_threshold !== undefined
          ? { autoBlacklistClickThreshold: effectiveAutoBlacklistThreshold(d.auto_blacklist_click_threshold) }
          : {}),
        ...(d.auto_blacklist_click_window_hours !== undefined
          ? { autoBlacklistClickWindowHours: d.auto_blacklist_click_window_hours }
          : {}),
      },
    });
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        blockEmptyUserAgent: true,
        blockBotClicks: true,
        blockProxyClicks: true,
        autoBlacklistClickThreshold: true,
        autoBlacklistClickWindowHours: true,
      },
    });
    res.json({
      block_empty_user_agent: u.blockEmptyUserAgent,
      block_bot_clicks: u.blockBotClicks,
      block_proxy_clicks: u.blockProxyClicks,
      auto_blacklist_click_threshold: u.autoBlacklistClickThreshold,
      auto_blacklist_click_window_hours: u.autoBlacklistClickWindowHours,
    });
  },

  async getAffiliateAutomizer(req: Request, res: Response) {
    const userId = billingUserId(req);
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        keywordAutomizerEnabled: true,
        keywordAutomizerDryRun: true,
        keywordAutomizerMinSpendUsd: true,
        keywordAutomizerMinClicks: true,
        keywordAutomizerLookbackDays: true,
        metaAdsAccountId: true,
        tiktokAdvertiserId: true,
      },
    });
    if (!u) return res.status(404).json({ error: "Utilizador não encontrado" });
    const logs = await prisma.affiliateAutomizerLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return res.json({
      enabled: u.keywordAutomizerEnabled,
      dry_run: u.keywordAutomizerDryRun,
      min_spend_usd: Number(u.keywordAutomizerMinSpendUsd),
      min_clicks: u.keywordAutomizerMinClicks,
      lookback_days: u.keywordAutomizerLookbackDays,
      meta_ads_account_id: u.metaAdsAccountId,
      tiktok_advertiser_id: u.tiktokAdvertiserId,
      recent_logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        keyword: l.keyword,
        reason: l.reason,
        dry_run: l.dryRun,
        ok: l.ok,
        created_at: l.createdAt.toISOString(),
      })),
    });
  },

  async patchAffiliateAutomizer(req: Request, res: Response) {
    const schema = z.object({
      enabled: z.boolean().optional(),
      dry_run: z.boolean().optional(),
      min_spend_usd: z.number().min(1).max(10000).optional(),
      min_clicks: z.number().int().min(1).max(100000).optional(),
      lookback_days: z.number().int().min(1).max(30).optional(),
      meta_ads_account_id: z.string().max(64).nullable().optional(),
      tiktok_advertiser_id: z.string().max(64).nullable().optional(),
      sync_costs_now: z.boolean().optional(),
      run_automizer_now: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const d = parsed.data;
    const userId = billingUserId(req);
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(d.enabled !== undefined ? { keywordAutomizerEnabled: d.enabled } : {}),
        ...(d.dry_run !== undefined ? { keywordAutomizerDryRun: d.dry_run } : {}),
        ...(d.min_spend_usd !== undefined ? { keywordAutomizerMinSpendUsd: d.min_spend_usd } : {}),
        ...(d.min_clicks !== undefined ? { keywordAutomizerMinClicks: d.min_clicks } : {}),
        ...(d.lookback_days !== undefined ? { keywordAutomizerLookbackDays: d.lookback_days } : {}),
        ...(d.meta_ads_account_id !== undefined
          ? { metaAdsAccountId: d.meta_ads_account_id?.replace(/^act_/, "").trim() || null }
          : {}),
        ...(d.tiktok_advertiser_id !== undefined
          ? { tiktokAdvertiserId: d.tiktok_advertiser_id?.replace(/\D/g, "") || null }
          : {}),
      },
    });

    if (d.sync_costs_now) {
      const { syncAdCostsForUser } = await import("../modules/affiliateOps/costSync.service");
      void syncAdCostsForUser(userId, 14).catch((e) => console.error("[syncAdCostsForUser]", e));
    }
    if (d.run_automizer_now) {
      const { runKeywordAutomizerForUser } = await import(
        "../modules/affiliateOps/keywordAutomizer.service"
      );
      void runKeywordAutomizerForUser(userId).catch((e) => console.error("[runKeywordAutomizer]", e));
    }

    return integrationsController.getAffiliateAutomizer(req, res);
  },

  async listWhitelist(req: Request, res: Response) {
    const rows = await prisma.whitelistedIp.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        ip: r.ipAddress,
        note: r.note,
        added_at: r.createdAt.toISOString(),
      })),
    );
  },

  async addWhitelist(req: Request, res: Response) {
    const schema = z.object({
      ip: z.string().min(7),
      note: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const ipNorm = parseIpv4Blacklist(parsed.data.ip);
    if (!ipNorm) {
      return res.status(400).json({ error: "Indique um IPv4 válido (ex.: 203.0.113.1)" });
    }
    const userId = billingUserId(req);
    await prisma.whitelistedIp.upsert({
      where: { userId_ipAddress: { userId, ipAddress: ipNorm } },
      create: {
        userId,
        ipAddress: ipNorm,
        note: parsed.data.note?.trim() || null,
      },
      update: { note: parsed.data.note?.trim() || null },
    });
    return res.json({ ok: true, ip: ipNorm });
  },

  async removeWhitelist(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "ID em falta" });
    const result = await prisma.whitelistedIp.deleteMany({
      where: { id, userId: billingUserId(req) },
    });
    if (result.count === 0) return res.status(404).json({ error: "Entrada não encontrada" });
    return res.json({ ok: true });
  },
};

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function onlyDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

/** IPv4 só — alinhado com `normalizeIpForMatch` na verificação de tracking. */
function parseIpv4Blacklist(raw: string): string | null {
  const t = normalizeIpForMatch(raw.trim());
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(t)) return null;
  const parts = t.split(".").map(Number);
  if (parts.some((n) => n > 255 || n < 0)) return null;
  return t;
}
