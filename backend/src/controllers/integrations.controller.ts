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
import { notifyUnattributedSale } from "../lib/opsObservability";
import {
  bootstrapGoogleAdsAfterOAuth,
  getGoogleAdsApiClientConfigFromEnv,
  isGoogleAdsClickUploadReadyForUser,
} from "../modules/googleAds/googleAds.service";
import { linkAllPaidProjectsFromIntegrations } from "../paid/google-ads-link-from-integrations";
import { syncAdCostsForUser } from "../modules/affiliateOps/costSync.service";
import {
  isMetaCapiReadyForUser,
  reportPartialRefundToMetaCapi,
} from "../modules/metaCapi/metaCapi.service";
import {
  isTikTokEventsReadyForUser,
  reportPartialRefundToTikTokEvents,
} from "../modules/tiktokEvents/tiktokEvents.service";
import {
  REFUND_SYNC_CHANNELS,
  retryDeadConversionSyncJobs,
  type ConversionSyncChannel,
} from "../lib/conversionSyncQueue";
import { loadSyncQueueHealth } from "../lib/syncHealth";
import { enqueueConversionSync } from "../lib/conversionSyncQueue";
import { onlyDigits, parseIpv4Blacklist, pickString } from "../lib/stringPrimitives";
import { subscriptionPlanForWebhookGate } from "../lib/affiliateWebhookPlan";
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
import { denyIfCannotReadIntegrationSecrets } from "./workspace.controller";

const TEST_SALE_ORDER_PREFIX = "clickora-test-";

const profileNotifySchema = z.object({
  sale_notify_email: z.union([z.string().email(), z.literal("")]).optional(),
  sale_chime: z.enum(["kaching", "chaching", "registradora", "moedas", "chuva", "sino"]).optional(),
});

export const integrationsController = {
  /** URL do webhook + estado (autenticado). */
  async getAffiliateWebhookInfo(req: Request, res: Response) {
    if (await denyIfCannotReadIntegrationSecrets(req, res)) return;
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
      select: { saleNotifyEmail: true, saleChime: true, email: true },
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
      sale_chime: user.saleChime ?? "kaching",
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
    /** Vendas de teste (ClickBank TEST*, botão «Testar ligação») validam o webhook mas nunca vão para Google/Meta/TikTok. */
    const isTestSale =
      (parsed.adapterId === "clickbank" && /^TEST/i.test(statusRaw ?? "")) ||
      (externalOrderId ?? "").startsWith(TEST_SALE_ORDER_PREFIX);

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
      ...(isTestSale ? { test_sale: true } : {}),
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
        void enqueueConversionSync({
          conversionId: existing.id,
          userId: user!.id,
          channels: ["google_ads_restate"],
        }).catch((err) => console.error("[enqueueConversionSync:restate]", err));
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
      void enqueueConversionSync({
        conversionId: existing.id,
        userId: user!.id,
        channels: REFUND_SYNC_CHANNELS,
      }).catch((err) => console.error("[enqueueConversionSync:refund]", err));
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
        if (status === "approved" && !isTestSale && data.presellId && data.attribution === "attributed") {
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
        if (isTestSale) return data.attribution === "attributed" ? "created" : "created_unattributed";
        // Também unattributed: o worker marca skipped_no_gclid/fbclid/ttclid
        // para Relatórios e sync_health não ficarem «OK» em silêncio.
        void enqueueConversionSync({
          conversionId: createdConv.id,
          userId: user!.id,
        }).catch((err) => console.error("[enqueueConversionSync]", err));
        return data.attribution === "attributed" ? "created" : "created_unattributed";
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
        if (!isTestSale && existing.presellId && existing.attribution === "attributed") {
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
        if (!isTestSale) {
          void enqueueConversionSync({
            conversionId: existing.id,
            userId: user!.id,
          }).catch((err) => console.error("[enqueueConversionSync]", err));
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
          if (!isTestSale) {
            void enqueueConversionSync({
              conversionId: existing.id,
              userId: user!.id,
              channels: ["google_ads_restate"],
            }).catch((err) => console.error("[enqueueConversionSync:restate]", err));
          }
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
        product: parsed.product,
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

    if (conversionResult === "created_unattributed") {
      void notifyUnattributedSale({
        userId: user.id,
        platform,
        orderId: externalOrderId ?? null,
        reason: unattributedReason,
      });
    }

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
      "Este e-mail confirma que os alertas de venda da dclickora chegam a esta caixa.\n" +
      "Não é uma venda.\n\n" +
      "Quando a rede aprovar uma venda, este e-mail e o cartão do telemóvel trazem o produto e a comissão que a rede enviar.\n" +
      "Chegam com dados móveis ou Wi-Fi, mesmo com o browser fechado.\n" +
      "O cartão do telemóvel activa-se uma vez em Integrações → Postback, nesse aparelho.\n";

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
    const orderId = `${TEST_SALE_ORDER_PREFIX}${Date.now()}`;
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

  /**
   * Diagnóstico ponta a ponta: clique Ads OK ≠ venda no relatório.
   * A venda só entra quando a rede chama o affiliate-webhook com UUID (subid2/sid1).
   */
  async diagnoseSalesPipeline(req: Request, res: Response) {
    if (await denyIfCannotReadIntegrationSecrets(req, res)) return;
    const userId = billingUserId(req);
    const sub = await subscriptionPlanForWebhookGate(userId);
    const planOk = planAllowsAffiliateWebhook(sub?.plan);

    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [clicks, conversions, postbacks, recentClicksMeta, googleUser] = await Promise.all([
      systemPrisma.trackingEvent.count({
        where: { userId, eventType: "click", createdAt: { gte: since } },
      }),
      systemPrisma.conversion.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          status: true,
          attribution: true,
          amount: true,
          currency: true,
          clickId: true,
          presellId: true,
          externalOrderId: true,
          googleAdsSync: true,
          createdAt: true,
          metadata: true,
        },
      }),
      systemPrisma.postbackLog.findMany({
        where: {
          userId,
          createdAt: { gte: since },
          NOT: { platform: { in: ["google_ads_offline_upload", "tracking_guard", "blacklist_block"] } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          platform: true,
          status: true,
          message: true,
          createdAt: true,
          payload: true,
        },
      }),
      systemPrisma.trackingEvent.findMany({
        where: { userId, eventType: "click", createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { id: true, createdAt: true, metadata: true, campaign: true },
      }),
      systemPrisma.user.findUnique({
        where: { id: userId },
        select: {
          googleAdsEnabled: true,
          googleAdsCustomerId: true,
          googleAdsConversionActionId: true,
        },
      }),
    ]);

    const hasPaidClickId = (meta: unknown): boolean => {
      if (!meta || typeof meta !== "object" || Array.isArray(meta)) return false;
      const m = meta as Record<string, unknown>;
      for (const k of ["gclid", "gbraid", "wbraid"] as const) {
        const v = m[k];
        if (typeof v === "string" && v.trim() && !/^\{/.test(v.trim())) return true;
      }
      return false;
    };
    const lastClickWithGclid = recentClicksMeta.find((c) => hasPaidClickId(c.metadata)) ?? null;

    const approved = conversions.filter((c) => c.status === "approved");
    const unattributed = approved.filter((c) => c.attribution === "unattributed" || !c.clickId);
    const pending = conversions.filter((c) => c.status === "pending");
    const networkPostbacks = postbacks.filter((p) => p.platform !== "clickora_test");
    const ignored = networkPostbacks.filter(
      (p) =>
        p.status === "ignored" ||
        p.status === "rejected" ||
        (typeof p.message === "string" && /ignored|missing_click|sem_encomenda/i.test(p.message)),
    );
    const createdLogs = networkPostbacks.filter(
      (p) => typeof p.message === "string" && /created/i.test(p.message),
    );

    const blockers: Array<{ code: string; severity: "critical" | "warn" | "info"; detail: string }> = [];
    if (!planOk) {
      blockers.push({
        code: "AFFILIATE_WEBHOOK_PLAN",
        severity: "critical",
        detail: "O plano não tem webhook de afiliados activo — a rede não consegue registar vendas.",
      });
    }
    if (clicks === 0) {
      blockers.push({
        code: "NO_CLICKS",
        severity: "critical",
        detail: "Sem cliques nos últimos 14 dias. O URL da oferta tem de gerar um clique em /track/r/ antes da venda.",
      });
    }
    if (clicks > 0 && networkPostbacks.length === 0 && approved.length === 0) {
      blockers.push({
        code: "NO_POSTBACK",
        severity: "critical",
        detail:
          "Há cliques mas zero avisos da rede. Cole o URL de Integrações → Postback na BuyGoods/Digistore/MaxWeb (com {SUBID2} ou {sid1}). Testar o URL da lander NÃO configura o postback.",
      });
    }
    if (unattributed.length > 0) {
      blockers.push({
        code: "UNATTRIBUTED_SALES",
        severity: "warn",
        detail: `${unattributed.length} venda(s) sem clique ligado (falta UUID no postback). Na MaxWeb/BuyGoods use {SUBID2}; na Digistore use {sid1}. Aparecem em Resultados → Conversões mas não sobem ao Google Ads nem à presell.`,
      });
    }
    if (pending.length > 0) {
      blockers.push({
        code: "PENDING_SALES",
        severity: "info",
        detail: `${pending.length} venda(s) pending — o relatório de receita só conta status=approved.`,
      });
    }
    if (ignored.length > 0 && createdLogs.length === 0) {
      blockers.push({
        code: "POSTBACKS_IGNORED",
        severity: "warn",
        detail:
          "A rede está a chamar o webhook mas os avisos foram ignorados (macros/estado/funnel). Veja os últimos logs abaixo.",
      });
    }
    const googleReady =
      Boolean(googleUser?.googleAdsEnabled) &&
      Boolean(googleUser?.googleAdsCustomerId?.trim()) &&
      Boolean(googleUser?.googleAdsConversionActionId?.trim());
    const syncSkipped = approved.filter((c) =>
      ["skipped_no_gclid", "skipped_disabled", "skipped_no_config", "error"].includes(
        String(c.googleAdsSync || ""),
      ),
    );
    if (googleReady && syncSkipped.length > 0) {
      blockers.push({
        code: "GOOGLE_ADS_SYNC_SKIP",
        severity: "warn",
        detail: `${syncSkipped.length} venda(s) não foram enviadas ao Google Ads (sem gclid no clique, sync desligado, ou erro). Relatório Clickora ≠ conversões no painel Google.`,
      });
    }
    if (!lastClickWithGclid && clicks > 0 && googleReady) {
      blockers.push({
        code: "NO_GCLID_ON_CLICKS",
        severity: "warn",
        detail:
          "Cliques sem gclid/gbraid/wbraid — o Google Ads não recebe conversões offline. Confirme auto-tagging e a Final URL da campanha.",
      });
    }

    const verdict =
      approved.length > 0 && unattributed.length === 0 && blockers.every((b) => b.severity !== "critical")
        ? "ok"
        : blockers.some((b) => b.severity === "critical")
          ? "blocked"
          : "needs_attention";

    return res.json({
      ok: verdict === "ok",
      verdict,
      window_days: 14,
      plan_webhook_enabled: planOk,
      counts: {
        clicks,
        conversions_total: conversions.length,
        conversions_approved: approved.length,
        conversions_unattributed: unattributed.length,
        conversions_pending: pending.length,
        network_postbacks: networkPostbacks.length,
        postbacks_ignored_or_rejected: ignored.length,
      },
      google_ads: {
        upload_enabled: googleReady,
        last_click_with_gclid_at: lastClickWithGclid?.createdAt?.toISOString() ?? null,
      },
      blockers,
      recent_conversions: approved.slice(0, 8).map((c) => {
        const meta = (c.metadata || {}) as Record<string, unknown>;
        return {
          id: c.id,
          status: c.status,
          attribution: c.attribution,
          amount: c.amount != null ? Number(c.amount) : null,
          currency: c.currency,
          click_id: c.clickId,
          presell_id: c.presellId,
          order_id: c.externalOrderId,
          google_ads_sync: c.googleAdsSync,
          unattributed_reason: typeof meta.unattributed_reason === "string" ? meta.unattributed_reason : null,
          created_at: c.createdAt.toISOString(),
        };
      }),
      recent_postbacks: networkPostbacks.slice(0, 10).map((p) => ({
        id: p.id,
        platform: p.platform,
        status: p.status,
        message: p.message,
        created_at: p.createdAt.toISOString(),
      })),
      next_steps: [
        "1. Copiar URL em Integrações → Postback (não o URL da lander).",
        "2. Colar na rede: BuyGoods/MaxWeb com {SUBID2}; Digistore24 com {sid1}+{cid}+billing_status+transaction_type.",
        "3. Clicar CTA real → fazer venda teste OU «Testar ligação» nesta página.",
        "4. Ver Resultados → Conversões (aprovadas). Aba «sem GCLID» = vendas sem upload Google.",
      ],
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

    res.json({
      google_ads_enabled: user.googleAdsEnabled,
      google_ads_customer_id: user.googleAdsCustomerId ?? "",
      google_ads_conversion_action_id: user.googleAdsConversionActionId ?? "",
      google_ads_login_customer_id: user.googleAdsLoginCustomerId ?? "",
      has_refresh_token: hasUserRefresh,
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

    /** Conta/MCC alterados em Integrações → alinhar todos os projectos Paid (sem import pesado). */
    let paid_projects_linked = 0;
    if (
      d.google_ads_customer_id !== undefined ||
      d.google_ads_login_customer_id !== undefined ||
      (d.google_ads_refresh_token !== undefined && d.google_ads_refresh_token.trim())
    ) {
      try {
        const { linkAllPaidProjectsFromIntegrations } = await import(
          "../paid/google-ads-link-from-integrations"
        );
        const linked = await linkAllPaidProjectsFromIntegrations(userId, {
          import_campaigns: false,
        });
        paid_projects_linked = linked.linked;
      } catch {
        paid_projects_linked = 0;
      }
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

    res.json({
      ok: true,
      google_ads_enabled: user.googleAdsEnabled,
      google_ads_customer_id: user.googleAdsCustomerId ?? "",
      google_ads_conversion_action_id: user.googleAdsConversionActionId ?? "",
      google_ads_login_customer_id: user.googleAdsLoginCustomerId ?? "",
      has_refresh_token: hasUserRefresh,
      api_env_configured: envOk,
      can_upload: isGoogleAdsClickUploadReadyForUser(user),
      paid_projects_linked,
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
          "Credenciais Google Ads API em falta no servidor (GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET).",
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
        void linkAllPaidProjectsFromIntegrations(decoded.userId, { import_campaigns: true }).catch((e) =>
          console.warn("[googleAdsOAuthCallback] paid link", e),
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
        void linkAllPaidProjectsFromIntegrations(userId, { import_campaigns: true }).catch((e) =>
          console.warn("[bootstrapGoogleAds] paid link", e),
        );
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
      const raw = d.meta_pixel_id.trim();
      const fromInit = raw.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/i);
      const t = (fromInit?.[1] || raw).replace(/\D/g, "");
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

    // Auto-activar quando Pixel + token existem (menos um interruptor para o utilizador).
    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        metaCapiEnabled: true,
        metaPixelId: true,
        metaAccessToken: true,
        metaCapiTestEventCode: true,
      },
    });
    if (!after) return res.status(404).json({ error: "Utilizador não encontrado" });
    const hasCreds =
      Boolean(after.metaPixelId?.trim()) && Boolean(decryptSecretField(after.metaAccessToken)?.trim());
    if (hasCreds && !after.metaCapiEnabled && d.meta_capi_enabled !== false) {
      await prisma.user.update({ where: { id: userId }, data: { metaCapiEnabled: true } });
      after.metaCapiEnabled = true;
    }
    if (!hasCreds && after.metaCapiEnabled && (d.clear_meta_access_token || data.metaPixelId === null)) {
      await prisma.user.update({ where: { id: userId }, data: { metaCapiEnabled: false } });
      after.metaCapiEnabled = false;
    }

    res.json({
      ok: true,
      meta_capi_enabled: after.metaCapiEnabled,
      meta_pixel_id: after.metaPixelId ?? "",
      has_access_token: Boolean(after.metaAccessToken?.trim()),
      meta_capi_test_event_code: after.metaCapiTestEventCode ?? "",
      can_send: isMetaCapiReadyForUser(after),
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
      const raw = d.tiktok_pixel_id.trim();
      const fromLoad = raw.match(/ttq\.load\s*\(\s*['"]([A-Z0-9]{10,64})['"]/i);
      const t = (fromLoad?.[1] || raw).replace(/[^A-Za-z0-9]/g, "");
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

    const after = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tiktokEventsEnabled: true,
        tiktokPixelId: true,
        tiktokEventsAccessToken: true,
        tiktokEventsTestEventCode: true,
      },
    });
    if (!after) return res.status(404).json({ error: "Utilizador não encontrado" });
    const hasCreds =
      Boolean(after.tiktokPixelId?.trim()) &&
      Boolean(decryptSecretField(after.tiktokEventsAccessToken)?.trim());
    if (hasCreds && !after.tiktokEventsEnabled && d.tiktok_events_enabled !== false) {
      await prisma.user.update({ where: { id: userId }, data: { tiktokEventsEnabled: true } });
      after.tiktokEventsEnabled = true;
    }
    if (
      !hasCreds &&
      after.tiktokEventsEnabled &&
      (d.clear_tiktok_events_access_token || data.tiktokPixelId === null)
    ) {
      await prisma.user.update({ where: { id: userId }, data: { tiktokEventsEnabled: false } });
      after.tiktokEventsEnabled = false;
    }

    res.json({
      ok: true,
      tiktok_events_enabled: after.tiktokEventsEnabled,
      tiktok_pixel_id: after.tiktokPixelId ?? "",
      has_access_token: Boolean(after.tiktokEventsAccessToken?.trim()),
      tiktok_events_test_event_code: after.tiktokEventsTestEventCode ?? "",
      can_send: isTikTokEventsReadyForUser(after),
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
    const data: { saleNotifyEmail?: string | null; saleChime?: string } = {};
    if (raw !== undefined) data.saleNotifyEmail = raw === "" ? null : raw;
    if (parsed.data.sale_chime) data.saleChime = parsed.data.sale_chime;

    const userId = billingUserId(req);
    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: userId }, data });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { saleNotifyEmail: true, saleChime: true },
    });

    return res.json({
      ok: true,
      sale_notify_email: user?.saleNotifyEmail ?? "",
      sale_chime: user?.saleChime ?? "kaching",
    });
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
    const user = await systemPrisma.user.findUnique({
      where: { id: userId },
      select: { saleChime: true },
    });
    await sendWebPushToUser(userId, {
      title: "Nova venda aprovada!",
      body: "Teste da dclickora. Numa venda real, a comissão que a rede enviar aparece aqui.",
      url: "/resultados/relatorios/conversoes",
      tag: `sale-test-${Date.now()}`,
      chime: true,
      chimeSound: user?.saleChime ?? "kaching",
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
        googleAdsEnabled: true,
        googleAdsCustomerId: true,
        googleAdsConversionActionId: true,
        googleAdsLoginCustomerId: true,
        googleAdsRefreshToken: true,
      },
    });
    if (!u) return res.status(404).json({ error: "Utilizador não encontrado" });
    const [logs, lastCost] = await Promise.all([
      prisma.affiliateAutomizerLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.adPlatformCostDaily
        .findFirst({
          where: { userId },
          orderBy: { syncedAt: "desc" },
          select: { syncedAt: true },
        })
        .catch(() => null),
    ]);
    const { evaluateCostSyncFreshness } = await import("../lib/accountHealth");
    const { isGoogleAdsMetricsReadyForUser } = await import("../modules/googleAds/googleAds.service");
    const googleReady = isGoogleAdsMetricsReadyForUser(u);
    const freshness = evaluateCostSyncFreshness({
      syncedAt: lastCost?.syncedAt,
      googleReady,
    });
    return res.json({
      enabled: u.keywordAutomizerEnabled,
      dry_run: u.keywordAutomizerDryRun,
      min_spend_usd: Number(u.keywordAutomizerMinSpendUsd),
      min_clicks: u.keywordAutomizerMinClicks,
      lookback_days: u.keywordAutomizerLookbackDays,
      meta_ads_account_id: u.metaAdsAccountId,
      tiktok_advertiser_id: u.tiktokAdvertiserId,
      last_cost_sync_at: lastCost?.syncedAt?.toISOString() ?? null,
      cost_sync_ok: freshness.ok,
      cost_sync_stale: freshness.stale,
      google_ads_ready: googleReady,
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

    let cost_sync: Awaited<
      ReturnType<(typeof import("../modules/affiliateOps/costSync.service"))["syncAdCostsForUser"]>
    > | null = null;
    let automizer_run: Awaited<
      ReturnType<
        (typeof import("../modules/affiliateOps/keywordAutomizer.service"))["runKeywordAutomizerForUser"]
      >
    > | null = null;

    if (d.sync_costs_now) {
      const { syncAdCostsForUser } = await import("../modules/affiliateOps/costSync.service");
      try {
        cost_sync = await syncAdCostsForUser(userId, 14);
      } catch (e) {
        console.error("[syncAdCostsForUser]", e);
        cost_sync = {
          google: { ok: false, error: e instanceof Error ? e.message : String(e) },
          meta: { ok: false, error: "skipped" },
          tiktok: { ok: false, error: "skipped" },
        };
      }
    }
    if (d.run_automizer_now) {
      const { runKeywordAutomizerForUser } = await import(
        "../modules/affiliateOps/keywordAutomizer.service"
      );
      try {
        automizer_run = await runKeywordAutomizerForUser(userId);
      } catch (e) {
        console.error("[runKeywordAutomizer]", e);
        automizer_run = { evaluated: 0, paused: 0, dry_run: 0, skipped: 1 };
      }
    }

    let base: Record<string, unknown> = {};
    const captureRes = {
      status() {
        return this;
      },
      json(body: unknown) {
        base = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
        return this;
      },
    };
    await integrationsController.getAffiliateAutomizer(req, captureRes as unknown as Response);

    return res.json({
      ...base,
      ...(cost_sync ? { cost_sync } : {}),
      ...(automizer_run ? { automizer_run } : {}),
    });
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

  /** Estado da fila conversion_sync_jobs (7d). */
  async getConversionSyncQueue(req: Request, res: Response) {
    const userId = billingUserId(req);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    since.setUTCHours(0, 0, 0, 0);
    const queue = await loadSyncQueueHealth({ userId, since, periodDays: 7 });
    return res.json({ sync_queue: queue });
  },

  /** Reprocessa jobs dead → pending (sem inventar credenciais). */
  async retryConversionSyncDead(req: Request, res: Response) {
    const userId = billingUserId(req);
    const body = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).optional(),
        channel: z.enum(["google_ads", "meta_capi", "tiktok_events"]).optional(),
      })
      .safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: "Dados inválidos" });
    const result = await retryDeadConversionSyncJobs({
      userId,
      limit: body.data.limit,
      channel: body.data.channel as ConversionSyncChannel | undefined,
    });
    return res.json({ ok: true, ...result });
  },
};

