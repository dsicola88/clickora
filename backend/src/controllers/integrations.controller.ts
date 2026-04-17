import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import { createPostbackToken, verifyPostbackToken } from "../lib/postbackToken";
import { publicApiBaseFromRequest } from "../lib/publicApiBase";
import { sendTransactionalEmail } from "../lib/mailer";
import {
  extractClickIdFromPayload,
  flattenAffiliatePayload,
  isApprovedSaleStatus,
  pickAmountDecimal,
  pickCurrency,
} from "../lib/affiliatePostbackParsers";
import {
  getGoogleAdsApiClientConfigFromEnv,
  isGoogleAdsClickUploadReadyForUser,
  syncConversionToGoogleAds,
} from "../modules/googleAds/googleAds.service";
import { isMetaCapiReadyForUser, syncConversionToMetaCapi } from "../modules/metaCapi/metaCapi.service";
import { normalizeIpForMatch } from "../lib/normalizeIp";
import { sendTelegram } from "../lib/telegram";
import { notifyTelegramPostbackWarning, notifyTelegramSale } from "../lib/telegramNotifications";
import { notifyWebPushConversion } from "../lib/webPushNotifications";
import {
  ensureWebPushFromEnv,
  getVapidPublicKeyFromEnv,
  isWebPushConfigured,
  sendWebPushToUser,
} from "../lib/webPush";
import { decryptSecretField, encryptSecretField } from "../lib/fieldEncryption";

const profileNotifySchema = z.object({
  sale_notify_email: z.union([z.string().email(), z.literal("")]).optional(),
});

export const integrationsController = {
  /** URL do webhook + estado (autenticado). */
  async getAffiliateWebhookInfo(req: Request, res: Response) {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { saleNotifyEmail: true, email: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const token = createPostbackToken(userId);
    const base = publicApiBaseFromRequest(req);
    const hook_url = `${base}/integrations/affiliate-webhook?token=${encodeURIComponent(token)}`;

    res.json({
      hook_url,
      sale_notify_email: user.saleNotifyEmail ?? "",
      fallback_account_email: user.email,
      smtp_configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
    });
  },

  /**
   * Postback HTTP das redes. Com status de venda aprovada + clickora_click_id (UUID do clique),
   * cria registo em `conversions` e incrementa conversões da presell (1 clique = 1 conversão).
   */
  async affiliateWebhook(req: Request, res: Response) {
    const tokenRaw = req.query.token?.toString();
    const decoded = tokenRaw ? verifyPostbackToken(tokenRaw) : null;
    if (!decoded) return res.status(401).json({ error: "Token inválido ou ausente" });

    const user = await systemPrisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, saleNotifyEmail: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const flat = flattenAffiliatePayload(req);
    const platform =
      flat.platform ||
      pickString(req.query.platform?.toString(), (req.body as Record<string, unknown>)?.platform) ||
      "postback";

    const clickId = extractClickIdFromPayload(flat);
    const statusRaw =
      flat.status || flat.payment_status || flat.order_status || flat.STATE || flat.state;
    const approved = isApprovedSaleStatus(statusRaw);

    type ConversionResult =
      | "created"
      | "duplicate"
      | "skipped_not_approved"
      | "skipped_no_click_id"
      | "invalid_click";

    let conversionResult: ConversionResult = "skipped_no_click_id";
    let presellPageId: string | null = null;
    let createdConversionId: string | null = null;

    if (!approved) {
      conversionResult = "skipped_not_approved";
    } else if (!clickId) {
      conversionResult = "skipped_no_click_id";
    } else {
      const click = await systemPrisma.trackingEvent.findFirst({
        where: { id: clickId, userId: user.id, eventType: "click" },
      });
      if (!click?.presellPageId) {
        conversionResult = "invalid_click";
      } else {
        presellPageId = click.presellPageId;
        const amount = pickAmountDecimal(flat);
        const currency = pickCurrency(flat);
        const metadata = { ...flat, platform, postback_status: statusRaw } as Prisma.InputJsonValue;

        try {
          const [createdConv] = await systemPrisma.$transaction([
            systemPrisma.conversion.create({
              data: {
                clickId,
                userId: user.id,
                presellId: click.presellPageId,
                campaign: click.campaign,
                amount: amount ?? undefined,
                currency,
                status: "approved",
                metadata,
              },
            }),
            systemPrisma.presellPage.update({
              where: { id: click.presellPageId },
              data: { conversions: { increment: 1 } },
            }),
          ]);
          createdConversionId = createdConv.id;
          conversionResult = "created";
          notifyTelegramSale(user.id, {
            platform,
            amount: amount != null ? amount.toString() : undefined,
            currency: currency ?? undefined,
            conversionId: createdConv.id,
          });
          notifyWebPushConversion(user.id, {
            platform,
            amount: amount != null ? amount.toString() : undefined,
            currency: currency ?? undefined,
          });
          void syncConversionToGoogleAds(createdConv.id).catch((err) =>
            console.error("[syncConversionToGoogleAds]", err),
          );
          void syncConversionToMetaCapi(createdConv.id).catch((err) =>
            console.error("[syncConversionToMetaCapi]", err),
          );
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            conversionResult = "duplicate";
          } else {
            throw e;
          }
        }
      }
    }

    const payloadLog = {
      platform,
      conversion: conversionResult,
      click_id: clickId,
      status_raw: statusRaw,
      flat,
      received_at: new Date().toISOString(),
    };

    const to = (user.saleNotifyEmail?.trim() || user.email).trim();
    const subject = `[dclickora] Postback ${platform} — ${conversionResult}`;
    const text = `Resultado: ${conversionResult}\n\n${JSON.stringify(payloadLog, null, 2)}`;
    const mail = await sendTransactionalEmail({ to, subject, text });

    await systemPrisma.postbackLog.create({
      data: {
        userId: user.id,
        presellPageId,
        platform: "affiliate_webhook",
        status: conversionResult === "created" || conversionResult === "duplicate" ? "success" : "info",
        message: conversionResult,
        payload: payloadLog as Prisma.InputJsonValue,
      },
    });

    if (
      approved &&
      (conversionResult === "invalid_click" || conversionResult === "skipped_no_click_id")
    ) {
      notifyTelegramPostbackWarning(user.id, {
        platform,
        result: conversionResult,
        clickId: clickId,
      });
    }

    return res.status(200).json({
      ok: true,
      conversion: conversionResult,
      ...(createdConversionId && { conversion_id: createdConversionId }),
      google_ads_sync_queued: conversionResult === "created",
      email_sent: mail.sent,
      ...(!mail.sent && { email_note: (mail as { reason: string }).reason }),
    });
  },

  /** Envia e-mail de teste para o destino configurado (autenticado). */
  async testSaleNotificationEmail(req: Request, res: Response) {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, saleNotifyEmail: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
      return res.status(503).json({
        error:
          "SMTP não configurado no servidor. O administrador deve definir SMTP_HOST e SMTP_FROM na API.",
      });
    }

    const to = (user.saleNotifyEmail?.trim() || user.email).trim();
    const subject = "[dclickora] Teste de notificação de venda";
    const text =
      "Este é um e-mail de teste do dclickora.\n\n" +
      "Se recebeu esta mensagem, o SMTP está correto e receberá alertas quando as redes enviarem POST para o seu webhook de afiliados.\n";

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

  /** Estado da integração Google Ads (offline conversions). */
  async getGoogleAdsSettings(req: Request, res: Response) {
    const userId = req.user!.userId;
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

    const userId = req.user!.userId;
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

  /** Meta Conversions API (Pixel server-side). */
  async getMetaCapiSettings(req: Request, res: Response) {
    const userId = req.user!.userId;
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

    const userId = req.user!.userId;
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

  async patchNotificationEmail(req: Request, res: Response) {
    const parsed = profileNotifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }

    const raw = parsed.data.sale_notify_email;
    const value = raw === "" || raw === undefined ? null : raw;

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { saleNotifyEmail: value },
    });

    return res.json({ ok: true, sale_notify_email: value ?? "" });
  },

  async getTelegramSettings(req: Request, res: Response) {
    const userId = req.user!.userId;
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

    const userId = req.user!.userId;
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
    const userId = req.user!.userId;
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
    const userId = req.user!.userId;
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

    const userId = req.user!.userId;
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
      where: { userId: req.user!.userId, endpoint: parsed.data.endpoint },
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
    const userId = req.user!.userId;
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
    const userId = req.user!.userId;
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
      where: { id, userId: req.user!.userId },
    });
    if (result.count === 0) return res.status(404).json({ error: "Entrada não encontrada" });
    return res.json({ ok: true });
  },

  async getTrackingGuards(req: Request, res: Response) {
    const userId = req.user!.userId;
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { blockEmptyUserAgent: true, blockBotClicks: true },
    });
    if (!u) return res.status(404).json({ error: "Utilizador não encontrado" });
    res.json({
      block_empty_user_agent: u.blockEmptyUserAgent,
      block_bot_clicks: u.blockBotClicks,
    });
  },

  async patchTrackingGuards(req: Request, res: Response) {
    const schema = z.object({
      block_empty_user_agent: z.boolean().optional(),
      block_bot_clicks: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos", details: parsed.error.flatten() });
    }
    const d = parsed.data;
    if (d.block_empty_user_agent === undefined && d.block_bot_clicks === undefined) {
      return res.status(400).json({ error: "Envie block_empty_user_agent e/ou block_bot_clicks" });
    }
    const userId = req.user!.userId;
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(d.block_empty_user_agent !== undefined ? { blockEmptyUserAgent: d.block_empty_user_agent } : {}),
        ...(d.block_bot_clicks !== undefined ? { blockBotClicks: d.block_bot_clicks } : {}),
      },
    });
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { blockEmptyUserAgent: true, blockBotClicks: true },
    });
    res.json({
      block_empty_user_agent: u.blockEmptyUserAgent,
      block_bot_clicks: u.blockBotClicks,
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
    const userId = req.user!.userId;
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
      where: { id, userId: req.user!.userId },
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
