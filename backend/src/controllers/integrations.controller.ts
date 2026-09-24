import { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma, { systemPrisma } from "../lib/prisma";
import { createPostbackToken, verifyPostbackToken } from "../lib/postbackToken";
import { publicApiBaseFromRequest } from "../lib/publicApiBase";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "../lib/mailer";
import {
  extractClickIdFromPayload,
  extractSaleStatusFromPayload,
  flattenAffiliatePayload,
  isApprovedSaleStatus,
  isNegativeSaleEvent,
  pickAmountDecimal,
  pickCurrency,
  pickOrderIdFromPayload,
} from "../lib/affiliatePostbackParsers";
import {
  getGoogleAdsApiClientConfigFromEnv,
  isGoogleAdsClickUploadReadyForUser,
  syncConversionToGoogleAds,
} from "../modules/googleAds/googleAds.service";
import { isMetaCapiReadyForUser, syncConversionToMetaCapi } from "../modules/metaCapi/metaCapi.service";
import { isTikTokEventsReadyForUser, syncConversionToTikTokEvents } from "../modules/tiktokEvents/tiktokEvents.service";
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
    const base = publicApiBaseFromRequest(req);
    const hook_url = `${base}/integrations/affiliate-webhook?token=${encodeURIComponent(token)}`;

    res.json({
      hook_url,
      sale_notify_email: user.saleNotifyEmail ?? "",
      fallback_account_email: user.email,
      smtp_configured: isTransactionalEmailConfigured(),
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
      select: { id: true, email: true, saleNotifyEmail: true },
    });
    if (!user) return res.status(404).json({ error: "Utilizador não encontrado" });

    const flat = flattenAffiliatePayload(req);
    const platform =
      flat.platform ||
      pickString(req.query.platform?.toString(), (req.body as Record<string, unknown>)?.platform) ||
      "postback";

    const clickId = extractClickIdFromPayload(flat);
    const statusRaw = extractSaleStatusFromPayload(flat);
    const approved = isApprovedSaleStatus(statusRaw) && !isNegativeSaleEvent(flat);
    const externalOrderId = pickOrderIdFromPayload(flat);
    const amount = pickAmountDecimal(flat);
    const currency = pickCurrency(flat);

    type ConversionResult =
      | "created"
      | "created_unattributed"
      | "duplicate"
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
    };

    async function createConversion(data: {
      clickId?: string | null;
      presellId?: string | null;
      campaign?: string | null;
      attribution: "attributed" | "unattributed";
      reason?: string;
    }): Promise<"created" | "created_unattributed" | "duplicate"> {
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
              status: "approved",
              attribution: data.attribution,
              externalOrderId: externalOrderId ?? undefined,
              metadata,
            },
          }),
        ];
        if (data.presellId && data.attribution === "attributed") {
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
        if (data.attribution === "attributed") {
          notifyTelegramSale(user!.id, {
            platform,
            amount: amount != null ? amount.toString() : undefined,
            currency: currency ?? undefined,
            conversionId: createdConv.id,
          });
          notifyWebPushConversion(user!.id, {
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

    if (!approved) {
      conversionResult = "skipped_not_approved";
    } else if (clickId) {
      const click = await systemPrisma.trackingEvent.findFirst({
        where: { id: clickId, userId: user.id, eventType: "click" },
      });
      if (!click?.presellPageId) {
        unattributedReason = click ? "click_without_presell" : "click_id_not_found";
        conversionResult = await createConversion({
          attribution: "unattributed",
          reason: unattributedReason,
        });
        if (conversionResult === "created_unattributed") {
          // Mantém etiqueta de auditoria: chegou UUID mas não bateu no clique.
          // O resultado HTTP continua created_unattributed; postbackLog.message distingue.
        }
      } else {
        presellPageId = click.presellPageId;
        conversionResult = await createConversion({
          clickId,
          presellId: click.presellPageId,
          campaign: click.campaign,
          attribution: "attributed",
        });
      }
    } else {
      unattributedReason = "missing_click_id";
      conversionResult = await createConversion({
        attribution: "unattributed",
        reason: unattributedReason,
      });
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

    const to = (user.saleNotifyEmail?.trim() || user.email).trim();
    /** E-mail só em venda atribuída nova — não spam em cada ping/teste/não aprovado. */
    const shouldEmail =
      conversionResult === "created" && Boolean(to) && Boolean(createdConversionId);
    let mail: { sent: boolean; reason?: string } = { sent: false, reason: "skipped_not_attributed_sale" };
    if (shouldEmail) {
      const subject = `[dclickora] Venda atribuída — ${platform}`;
      const text =
        `Venda registada e ligada a um clique na dclickora.\n\n` +
        `Plataforma: ${platform}\n` +
        `Valor: ${amount != null ? `${amount} ${currency ?? ""}` : "—"}\n` +
        `Encomenda: ${externalOrderId ?? "—"}\n` +
        `Click ID: ${clickId ?? "—"}\n\n` +
        `Ver Relatórios → Conversões (estado Google/Meta/TikTok).`;
      mail = await sendTransactionalEmail({ to, subject, text });
    }

    const logStatus =
      conversionResult === "created" ||
      conversionResult === "created_unattributed" ||
      conversionResult === "duplicate"
        ? "success"
        : conversionResult === "skipped_not_approved"
          ? "rejected"
          : "info";

    await systemPrisma.postbackLog.create({
      data: {
        userId: user.id,
        presellPageId,
        platform: "affiliate_webhook",
        status: logStatus,
        message: unattributedReason
          ? `${conversionResult}:${unattributedReason}`
          : conversionResult,
        payload: payloadLog as Prisma.InputJsonValue,
      },
    });

    if (approved && conversionResult === "created_unattributed") {
      notifyTelegramPostbackWarning(user.id, {
        platform,
        result: conversionResult,
        clickId: clickId,
      });
    }

    return res.status(200).json({
      ok: true,
      conversion: conversionResult,
      attribution: attribution,
      ...(unattributedReason ? { unattributed_reason: unattributedReason } : {}),
      ...(createdConversionId ? { conversion_id: createdConversionId } : {}),
      google_ads_sync_queued: conversionResult === "created",
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
      "Este e-mail confirma que a configuração SMTP do servidor dclickora está a funcionar.\n\n" +
      "Quando a rede de afiliados fizer postbacks de vendas aprovadas para o URL configurado em Plataformas, receberá notificações no mesmo endereço (ou no e-mail alternativo de alertas, se tiver definido um).\n" +
      "Também pode receber avisos de falhas de sincronização com Google Ads, Meta ou TikTok, se tiver notificações de problemas activas (Telegram ou e-mail).\n";

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
    const base = publicApiBaseFromRequest(req).replace(/\/+$/, "");
    const orderId = `clickora-test-${Date.now()}`;
    const u = new URL(`${base}/integrations/affiliate-webhook`);
    u.searchParams.set("token", token);
    u.searchParams.set("platform", platform);
    u.searchParams.set("status", "approved");
    u.searchParams.set("orderid", orderId);
    u.searchParams.set("amount", "1.00");
    u.searchParams.set("cy", "USD");
    // Cobrir aliases BuyGoods / SmartAdv / Digistore com o mesmo UUID do clique.
    u.searchParams.set("subid", lastClick.id);
    u.searchParams.set("subid1", lastClick.id);
    u.searchParams.set("sub3", lastClick.id);
    u.searchParams.set("cid", lastClick.id);
    u.searchParams.set("clickora_click_id", lastClick.id);

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
    const dashboard = `${frontend}/tracking/dashboard`;
    const redirectFail = (reason: string) =>
      res.redirect(`${dashboard}?google_ads_oauth=error&reason=${encodeURIComponent(reason)}`);
    const redirectOk = () => res.redirect(`${dashboard}?google_ads_oauth=success`);

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

    return redirectOk();
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
        autoBlacklistClickThreshold: true,
        autoBlacklistClickWindowHours: true,
      },
    });
    if (!u) return res.status(404).json({ error: "Utilizador não encontrado" });
    res.json({
      block_empty_user_agent: u.blockEmptyUserAgent,
      block_bot_clicks: u.blockBotClicks,
      auto_blacklist_click_threshold: u.autoBlacklistClickThreshold,
      auto_blacklist_click_window_hours: u.autoBlacklistClickWindowHours,
    });
  },

  async patchTrackingGuards(req: Request, res: Response) {
    const schema = z.object({
      block_empty_user_agent: z.boolean().optional(),
      block_bot_clicks: z.boolean().optional(),
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
        ...(d.auto_blacklist_click_threshold !== undefined
          ? { autoBlacklistClickThreshold: d.auto_blacklist_click_threshold }
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
        autoBlacklistClickThreshold: true,
        autoBlacklistClickWindowHours: true,
      },
    });
    res.json({
      block_empty_user_agent: u.blockEmptyUserAgent,
      block_bot_clicks: u.blockBotClicks,
      auto_blacklist_click_threshold: u.autoBlacklistClickThreshold,
      auto_blacklist_click_window_hours: u.autoBlacklistClickWindowHours,
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
