import { GoogleAdsApi, ResourceNames, enums, services } from "google-ads-api";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "../../lib/prisma";
import { pickOrderIdFromPayload } from "../../lib/affiliatePostbackParsers";
import { stringFieldsFromJson } from "../../lib/clickEventContext";
import { decryptSecretField } from "../../lib/fieldEncryption";
import { notifyUserConversionSyncFailure } from "../../lib/syncFailureAlerts";
import {
  GOOGLE_ADS_REPORTING_PLATFORM_NOT_READY,
  GOOGLE_ADS_REPORTING_USER_CUSTOMER_ID_REQUIRED,
  GOOGLE_ADS_REPORTING_USER_OAUTH_REQUIRED,
  googleAdsErrorText,
  humanizeGoogleAdsApiError,
  plainGoogleAdsError,
} from "./googleAdsApiErrors";

const DIGITS_ONLY = /^\d+$/;

function safeSerializeGoogleAdsResponse(response: unknown): unknown {
  try {
    return JSON.parse(
      JSON.stringify(response, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    );
  } catch {
    return { note: "unserializable_response" };
  }
}

function onlyDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

/** Formato esperado pela API: `yyyy-MM-dd HH:mm:ss±HH:mm` */
export function formatGoogleAdsConversionDateTime(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}+00:00`;
}

export type GoogleAdsApiCredentials = {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  loginCustomerId?: string;
};

export type GoogleAdsClientEnv = Pick<GoogleAdsApiCredentials, "developerToken" | "clientId" | "clientSecret" | "loginCustomerId">;

/** Cliente OAuth + developer token (obrigatório no servidor). O refresh token pode vir do utilizador. */
export function getGoogleAdsApiClientConfigFromEnv(): GoogleAdsClientEnv | null {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  /** Preferir GOOGLE_ADS_*; CLIENT_ID / CLIENT_SECRET são fallback para deploys onde só o par OAuth foi colocado com nomes curtos. */
  const clientId =
    process.env.GOOGLE_ADS_CLIENT_ID?.trim() || process.env.CLIENT_ID?.trim();
  const clientSecret =
    process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() || process.env.CLIENT_SECRET?.trim();
  const loginCustomerId = onlyDigits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim());
  if (!developerToken || !clientId || !clientSecret) return null;
  return { developerToken, clientId, clientSecret, loginCustomerId: loginCustomerId ?? undefined };
}

export function buildGoogleAdsCredentialsForUser(user: Pick<User, "googleAdsRefreshToken">): GoogleAdsApiCredentials | null {
  const base = getGoogleAdsApiClientConfigFromEnv();
  const refresh = resolveUserGoogleAdsRefreshToken(user);
  if (!base || !refresh) return null;
  return {
    developerToken: base.developerToken,
    clientId: base.clientId,
    clientSecret: base.clientSecret,
    refreshToken: refresh,
    loginCustomerId: base.loginCustomerId,
  };
}

export function resolveUserGoogleAdsRefreshToken(user: Pick<User, "googleAdsRefreshToken">): string | null {
  const raw = user.googleAdsRefreshToken?.trim();
  const fromUser = raw ? decryptSecretField(raw) : null;
  if (fromUser?.trim()) return fromUser.trim();
  return process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() || null;
}

export type GoogleAdsUserSettings = Pick<
  User,
  | "googleAdsEnabled"
  | "googleAdsCustomerId"
  | "googleAdsConversionActionId"
  | "googleAdsLoginCustomerId"
  | "googleAdsRefreshToken"
>;

/** True quando o envio server-side para o Google Ads pode ser tentado (env + utilizador). */
export function isGoogleAdsClickUploadReadyForUser(user: GoogleAdsUserSettings): boolean {
  if (!user.googleAdsEnabled) return false;
  if (!getGoogleAdsApiClientConfigFromEnv()) return false;
  if (!resolveUserGoogleAdsRefreshToken(user)) return false;
  const cid = onlyDigits(user.googleAdsCustomerId);
  if (!cid || !DIGITS_ONLY.test(cid)) return false;
  if (!user.googleAdsConversionActionId?.trim()) return false;
  return true;
}

/** GAQL: datas como YYYYMMDD (UTC alinhado ao intervalo do dashboard). */
export function formatGaqlDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Código estável para o cliente distinguir plataforma vs. passos do utilizador (evita mensagens genéricas). */
export type GoogleAdsReportingUnavailableCode =
  | "google_ads_platform_not_configured"
  | "google_ads_oauth_required"
  | "google_ads_customer_id_required";

/**
 * Porque os relatórios GAQL / métricas de conta não estão disponíveis, com mensagem adequada ao público.
 * `null` quando pode pedir-se dados à API.
 */
export function getGoogleAdsReportingUnavailability(user: GoogleAdsUserSettings): {
  message: string;
  code: GoogleAdsReportingUnavailableCode;
} | null {
  if (!getGoogleAdsApiClientConfigFromEnv()) {
    return { message: GOOGLE_ADS_REPORTING_PLATFORM_NOT_READY, code: "google_ads_platform_not_configured" };
  }
  if (!resolveUserGoogleAdsRefreshToken(user)) {
    return { message: GOOGLE_ADS_REPORTING_USER_OAUTH_REQUIRED, code: "google_ads_oauth_required" };
  }
  const cid = onlyDigits(user.googleAdsCustomerId);
  if (!cid || !DIGITS_ONLY.test(cid)) {
    return { message: GOOGLE_ADS_REPORTING_USER_CUSTOMER_ID_REQUIRED, code: "google_ads_customer_id_required" };
  }
  return null;
}

/**
 * Métricas da conta (relatórios) — não exige `googleAdsEnabled` nem ação de conversão;
 * só customer ID + OAuth + credenciais API no servidor.
 */
export function isGoogleAdsMetricsReadyForUser(user: GoogleAdsUserSettings): boolean {
  return getGoogleAdsReportingUnavailability(user) === null;
}

export type GoogleAdsAccountMetrics = {
  impressions: number;
  clicks: number;
  conversions: number;
  /** Valores monetários nesta conta usam sempre `currency_code` (moeda da conta Google Ads — USD, EUR, BRL…). */
  cost_micros: number;
  /** ISO 4217, ex. USD ou BRL — vem da API (Google pode não disponibilizar em casos extremos). */
  currency_code: string | null;
};

export async function fetchGoogleAdsAccountMetrics(input: {
  user: GoogleAdsUserSettings;
  from: Date;
  to: Date;
}): Promise<{ ok: true; metrics: GoogleAdsAccountMetrics } | { ok: false; error: string }> {
  const block = getGoogleAdsReportingUnavailability(input.user);
  if (block) {
    return { ok: false, error: block.message };
  }
  const creds = buildGoogleAdsCredentialsForUser(input.user);
  if (!creds) {
    return {
      ok: false,
      error:
        "A ligação ao Google Ads ainda não está disponível. Contacte o suporte.",
    };
  }

  const customerId = onlyDigits(input.user.googleAdsCustomerId)!;
  const login = onlyDigits(input.user.googleAdsLoginCustomerId);

  const fromStr = formatGaqlDate(input.from);
  const toStr = formatGaqlDate(input.to);

  const client = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });

  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: creds.refreshToken,
    ...(login ? { login_customer_id: login } : {}),
  });

  const gaqlMetrics = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM customer
    WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'
  `;
  /** Moeda de faturação da conta (custos sempre nesta-divisa). */
  const gaqlCurrency = `SELECT customer.currency_code FROM customer LIMIT 1`;

  try {
    const [rows, currencyRows] = await Promise.all([customer.query(gaqlMetrics), customer.query(gaqlCurrency)]);
    let impressions = 0;
    let clicks = 0;
    let conversions = 0;
    let cost_micros = 0;
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      const m = row.metrics as
        | { impressions?: unknown; clicks?: unknown; conversions?: unknown; cost_micros?: unknown }
        | undefined;
      if (!m) continue;
      impressions += Number(m.impressions ?? 0);
      clicks += Number(m.clicks ?? 0);
      conversions += Number(m.conversions ?? 0);
      cost_micros += Number(m.cost_micros ?? 0);
    }

    let currency_code: string | null = null;
    const crList = Array.isArray(currencyRows) ? currencyRows : [];
    const first = crList[0] as Record<string, unknown> | undefined;
    if (first) {
      const cust = first.customer as { currency_code?: unknown; currencyCode?: unknown } | undefined;
      const raw = cust?.currency_code ?? cust?.currencyCode;
      if (typeof raw === "string") {
        const t = raw.trim().toUpperCase();
        currency_code = /^[A-Z]{3}$/.test(t) ? t : null;
      }
    }

    return {
      ok: true,
      metrics: { impressions, clicks, conversions, cost_micros, currency_code },
    };
  } catch (e) {
    return { ok: false, error: googleAdsErrorText(e) };
  }
}

/**
 * Pós-processamento de `POST /track/postback/google-ads`: já tem gclid no corpo, envia à API sem linha em `conversions`.
 */
export async function syncDirectGclidConversionToGoogleAds(input: {
  userId: string;
  presellPageId: string;
  gclid: string;
  conversionValue: number;
  currencyCode: string;
  orderId: string;
  conversionDateTime: Date;
}): Promise<void> {
  const user = await systemPrisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      googleAdsEnabled: true,
      googleAdsCustomerId: true,
      googleAdsConversionActionId: true,
      googleAdsLoginCustomerId: true,
      googleAdsRefreshToken: true,
    },
  });
  if (!user || !isGoogleAdsClickUploadReadyForUser(user)) return;

  const customerId = onlyDigits(user.googleAdsCustomerId)!;
  const actionId = user.googleAdsConversionActionId!.trim();
  const creds = buildGoogleAdsCredentialsForUser(user)!;
  const loginCustomerId = onlyDigits(user.googleAdsLoginCustomerId);

  const payloadLog = {
    source: "google_ads_postback",
    presell_page_id: input.presellPageId,
    gclid: input.gclid,
    order_id: input.orderId,
    value: input.conversionValue,
    currency: input.currencyCode,
    requested_at: new Date().toISOString(),
  };

  await systemPrisma.postbackLog.create({
    data: {
      userId: user.id,
      presellPageId: input.presellPageId,
      platform: "google_ads_offline_upload_direct",
      status: "pending",
      message: "request",
      payload: payloadLog as Prisma.InputJsonValue,
    },
  });

  const result = await uploadClickConversionToGoogleAds(creds, {
    customerId,
    conversionActionId: actionId,
    loginCustomerId,
    gclid: input.gclid,
    conversionDateTime: input.conversionDateTime,
    conversionValue: input.conversionValue,
    currencyCode: input.currencyCode,
    orderId: input.orderId,
  });

  if (result.ok) {
    await systemPrisma.postbackLog.create({
      data: {
        userId: user.id,
        presellPageId: input.presellPageId,
        platform: "google_ads_offline_upload_direct",
        status: "success",
        message: "Google Ads upload OK (postback direto)",
        payload: { ...payloadLog, response: result.raw } as Prisma.InputJsonValue,
      },
    });
  } else {
    await systemPrisma.postbackLog.create({
      data: {
        userId: user.id,
        presellPageId: input.presellPageId,
        platform: "google_ads_offline_upload_direct",
        status: "error",
        message: result.error.slice(0, 500),
        payload: { ...payloadLog, error: result.error, raw: result.raw } as Prisma.InputJsonValue,
      },
    });
  }
}

export type UploadClickConversionParams = {
  customerId: string;
  conversionActionId: string;
  loginCustomerId?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  conversionDateTime: Date;
  conversionValue: number;
  currencyCode: string;
  orderId: string;
};

export type UploadClickConversionResult =
  | { ok: true; raw: unknown }
  | { ok: false; error: string; raw?: unknown };

/**
 * Envia uma conversão offline (clique) para o Google Ads (Conversion Upload API).
 */
export async function uploadClickConversionToGoogleAds(
  creds: GoogleAdsApiCredentials,
  params: UploadClickConversionParams,
): Promise<UploadClickConversionResult> {
  const customerId = onlyDigits(params.customerId);
  const actionId = params.conversionActionId.replace(/\D/g, "");
  const login = onlyDigits(params.loginCustomerId ?? undefined);

  if (!customerId || !DIGITS_ONLY.test(customerId)) {
    return { ok: false, error: "google_ads_customer_id inválido" };
  }
  if (!actionId) {
    return { ok: false, error: "google_ads_conversion_action_id inválido" };
  }

  const hasClickId = Boolean(
    params.gclid?.trim() || params.gbraid?.trim() || params.wbraid?.trim(),
  );
  if (!hasClickId) {
    return { ok: false, error: "Sem gclid/gbraid/wbraid" };
  }

  const client = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });

  const refresh = creds.refreshToken;
  // Só MCC definido no perfil do utilizador. Não usar GOOGLE_ADS_LOGIN_CUSTOMER_ID aqui — em SaaS
  // misturava gestor com contas diretas e quebrava o upload para quem não usa MCC.
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: refresh,
    ...(login ? { login_customer_id: login } : {}),
  });

  const conversion_action = ResourceNames.conversionAction(customerId, actionId);
  const conversion_date_time = formatGoogleAdsConversionDateTime(params.conversionDateTime);

  const clickConv: Record<string, unknown> = {
    conversion_action,
    conversion_date_time,
    conversion_value: params.conversionValue,
    currency_code: params.currencyCode.toUpperCase().slice(0, 3),
    order_id: params.orderId.slice(0, 200),
  };
  if (params.gclid?.trim()) clickConv.gclid = params.gclid.trim();
  if (params.gbraid?.trim()) clickConv.gbraid = params.gbraid.trim();
  if (params.wbraid?.trim()) clickConv.wbraid = params.wbraid.trim();

  const request = new services.UploadClickConversionsRequest({
    customer_id: customerId,
    partial_failure: true,
    conversions: [clickConv],
  });

  try {
    const response = await customer.conversionUploads.uploadClickConversions(request);
    const serial = safeSerializeGoogleAdsResponse(response);
    const partial = response.partial_failure_error as { message?: string; details?: unknown[] } | null | undefined;
    if (partial && (partial.message || (partial.details && partial.details.length))) {
      const msg = partial.message || JSON.stringify(partial.details?.[0] ?? partial);
      return { ok: false, error: msg.slice(0, 2000), raw: serial };
    }
    return { ok: true, raw: serial };
  } catch (e) {
    return { ok: false, error: googleAdsErrorText(e), raw: e };
  }
}

/**
 * Após criar `Conversion` aprovada no webhook de afiliados: envia para o Google Ads se configurado.
 * Idempotente se `googleAdsSync === sent`.
 */
export async function syncConversionToGoogleAds(conversionId: string): Promise<void> {
  const conv = await systemPrisma.conversion.findUnique({
    where: { id: conversionId },
    include: {
      click: true,
      user: true,
      presell: true,
    },
  });

  if (!conv || conv.status !== "approved") return;
  if (conv.googleAdsSync === "sent") return;
  if (!conv.click) {
    await markGoogleAdsSkip(conv.id, "skipped_no_gclid", {
      reason: "Conversão sem clique associado (não atribuída) — sem gclid/gbraid/wbraid para upload.",
    });
    return;
  }

  const user = conv.user;
  if (!user.googleAdsEnabled) {
    await markGoogleAdsSkip(conv.id, "skipped_disabled", {
      reason: "A integração Google Ads (upload por clique) está desactivada na conta.",
    });
    return;
  }

  const customerId = onlyDigits(user.googleAdsCustomerId);
  const actionId = user.googleAdsConversionActionId?.trim();
  if (!customerId || !actionId) {
    await markGoogleAdsSkip(conv.id, "skipped_no_config", {
      reason: "Indique o número da conta Google Ads em Integrações → Google Ads.",
    });
    return;
  }

  const creds = buildGoogleAdsCredentialsForUser(user);
  if (!creds) {
    await markGoogleAdsSkip(conv.id, "skipped_no_config", {
      reason:
        "A ligação ao Google Ads ainda não está disponível. Contacte o suporte.",
    });
    return;
  }

  const meta = (conv.click.metadata || {}) as Record<string, unknown>;
  const gclid = typeof meta.gclid === "string" ? meta.gclid : null;
  const gbraid = typeof meta.gbraid === "string" ? meta.gbraid : null;
  const wbraid = typeof meta.wbraid === "string" ? meta.wbraid : null;

  if (!gclid?.trim() && !gbraid?.trim() && !wbraid?.trim()) {
    await markGoogleAdsSkip(conv.id, "skipped_no_gclid", {
      reason:
        "O clique não contém gclid, gbraid nem wbraid. Active a etiquetagem automática e as campanhas com rastreio de cliques de pesquisa.",
    });
    return;
  }

  const flat = stringFieldsFromJson(conv.metadata);
  const orderId = conv.externalOrderId?.trim() || pickOrderIdFromPayload(flat) || conv.id;
  const amount = conv.amount != null ? Number(conv.amount) : 0;
  const currency = (conv.currency || "USD").toUpperCase().slice(0, 3);

  const loginCustomerId = onlyDigits(user.googleAdsLoginCustomerId);

  const payloadLog = {
    conversion_id: conv.id,
    click_id: conv.clickId,
    customer_id: customerId,
    order_id: orderId,
    gclid: gclid || null,
    gbraid: gbraid || null,
    wbraid: wbraid || null,
    value: amount,
    currency,
    requested_at: new Date().toISOString(),
  };

  await systemPrisma.postbackLog.create({
    data: {
      userId: user.id,
      presellPageId: conv.presellId,
      platform: "google_ads_offline_upload",
      status: "pending",
      message: "request",
      payload: payloadLog as Prisma.InputJsonValue,
    },
  });

  const result = await uploadClickConversionToGoogleAds(creds, {
    customerId,
    conversionActionId: actionId,
    loginCustomerId,
    gclid,
    gbraid,
    wbraid,
    conversionDateTime: conv.createdAt,
    conversionValue: amount,
    currencyCode: currency,
    orderId,
  });

  if (result.ok) {
    await systemPrisma.conversion.update({
      where: { id: conv.id },
      data: {
        googleAdsSync: "sent",
        googleAdsSyncedAt: new Date(),
        googleAdsSyncDetail: { ok: true, response: result.raw } as Prisma.InputJsonValue,
      },
    });
    await systemPrisma.postbackLog.create({
      data: {
        userId: user.id,
        presellPageId: conv.presellId,
        platform: "google_ads_offline_upload",
        status: "success",
        message: "Google Ads upload OK",
        payload: { ...payloadLog, response: result.raw } as Prisma.InputJsonValue,
      },
    });
  } else {
    await systemPrisma.conversion.update({
      where: { id: conv.id },
      data: {
        googleAdsSync: "failed",
        googleAdsSyncedAt: new Date(),
        googleAdsSyncDetail: { ok: false, error: result.error, raw: result.raw } as Prisma.InputJsonValue,
      },
    });
    await systemPrisma.postbackLog.create({
      data: {
        userId: user.id,
        presellPageId: conv.presellId,
        platform: "google_ads_offline_upload",
        status: "error",
        message: result.error.slice(0, 500),
        payload: { ...payloadLog, error: result.error, raw: result.raw } as Prisma.InputJsonValue,
      },
    });
    notifyUserConversionSyncFailure(user.id, {
      platform: "google_ads",
      conversionId: conv.id,
      error: result.error,
    });
  }
}

export type UploadConversionRestatementParams = {
  customerId: string;
  conversionActionId: string;
  loginCustomerId?: string | null;
  orderId: string;
  adjustmentDateTime: Date;
  restatedValue: number;
  currencyCode: string;
  gclid?: string | null;
  originalConversionDateTime?: Date | null;
};

/**
 * RESTATEMENT — corrige o valor de uma conversão já enviada (ex.: comissão parcial / ajuste de rede).
 */
export async function uploadConversionRestatementToGoogleAds(
  creds: GoogleAdsApiCredentials,
  params: UploadConversionRestatementParams,
): Promise<UploadClickConversionResult> {
  const customerId = onlyDigits(params.customerId);
  const actionId = params.conversionActionId.replace(/\D/g, "");
  const login = onlyDigits(params.loginCustomerId ?? undefined);
  const orderId = params.orderId.trim().slice(0, 200);

  if (!customerId || !DIGITS_ONLY.test(customerId)) {
    return { ok: false, error: "google_ads_customer_id inválido" };
  }
  if (!actionId) {
    return { ok: false, error: "google_ads_conversion_action_id inválido" };
  }
  if (!orderId) {
    return { ok: false, error: "order_id em falta para restatement" };
  }

  const client = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });

  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: creds.refreshToken,
    ...(login ? { login_customer_id: login } : {}),
  });

  const conversion_action = ResourceNames.conversionAction(customerId, actionId);
  const adjustment: Record<string, unknown> = {
    adjustment_type: enums.ConversionAdjustmentType.RESTATEMENT,
    conversion_action,
    adjustment_date_time: formatGoogleAdsConversionDateTime(params.adjustmentDateTime),
    order_id: orderId,
    restatement_value: {
      adjusted_value: params.restatedValue,
      currency_code: params.currencyCode.toUpperCase().slice(0, 3),
    },
  };
  if (params.gclid?.trim() && params.originalConversionDateTime) {
    adjustment.gclid_date_time_pair = {
      gclid: params.gclid.trim(),
      conversion_date_time: formatGoogleAdsConversionDateTime(params.originalConversionDateTime),
    };
  }

  const request = new services.UploadConversionAdjustmentsRequest({
    customer_id: customerId,
    partial_failure: true,
    conversion_adjustments: [adjustment],
  });

  try {
    const response = await customer.conversionAdjustmentUploads.uploadConversionAdjustments(request);
    const serial = safeSerializeGoogleAdsResponse(response);
    const partial = response.partial_failure_error as { message?: string; details?: unknown[] } | null | undefined;
    if (partial && (partial.message || (partial.details && partial.details.length))) {
      const msg = partial.message || JSON.stringify(partial.details?.[0] ?? partial);
      return { ok: false, error: msg.slice(0, 2000), raw: serial };
    }
    return { ok: true, raw: serial };
  } catch (e) {
    const msg = plainGoogleAdsError(e);
    return { ok: false, error: msg, raw: e };
  }
}

/**
 * Após alterar o valor de uma Conversion já enviada ao Google: RESTATEMENT.
 */
export async function restateConversionToGoogleAds(conversionId: string): Promise<void> {
  const conv = await systemPrisma.conversion.findUnique({
    where: { id: conversionId },
    include: { click: true, user: true },
  });
  if (!conv || conv.status !== "approved") return;
  if (conv.googleAdsSync !== "sent" && conv.googleAdsSync !== "restated") return;

  const user = conv.user;
  if (!user.googleAdsEnabled) return;
  const customerId = onlyDigits(user.googleAdsCustomerId);
  const actionId = user.googleAdsConversionActionId?.trim();
  if (!customerId || !actionId) return;
  const creds = buildGoogleAdsCredentialsForUser(user);
  if (!creds) return;

  const flat = stringFieldsFromJson(conv.metadata);
  const orderId = conv.externalOrderId?.trim() || pickOrderIdFromPayload(flat) || conv.id;
  const meta = (conv.click?.metadata || {}) as Record<string, unknown>;
  const gclid = typeof meta.gclid === "string" ? meta.gclid : null;
  const amount = conv.amount != null ? Number(conv.amount) : 0;
  const currency = (conv.currency || "USD").toUpperCase().slice(0, 3);
  const loginCustomerId = onlyDigits(user.googleAdsLoginCustomerId);
  const detail = (conv.googleAdsSyncDetail || {}) as Record<string, unknown>;

  const result = await uploadConversionRestatementToGoogleAds(creds, {
    customerId,
    conversionActionId: actionId,
    loginCustomerId,
    orderId,
    adjustmentDateTime: new Date(),
    restatedValue: amount,
    currencyCode: currency,
    gclid,
    originalConversionDateTime: conv.createdAt,
  });

  await systemPrisma.conversion.update({
    where: { id: conv.id },
    data: {
      googleAdsSync: result.ok ? "restated" : conv.googleAdsSync,
      googleAdsSyncedAt: new Date(),
      googleAdsSyncDetail: {
        ...detail,
        restatement: result.ok ? "sent" : "failed",
        restatement_error: result.ok ? undefined : result.error,
        restatement_raw: result.raw,
        restated_value: amount,
      } as Prisma.InputJsonValue,
    },
  });

  await systemPrisma.postbackLog.create({
    data: {
      userId: user.id,
      presellPageId: conv.presellId,
      platform: "google_ads_conversion_restatement",
      status: result.ok ? "success" : "error",
      message: result.ok ? "Google Ads RESTATEMENT OK" : (result.error || "fail").slice(0, 500),
      payload: {
        conversion_id: conv.id,
        order_id: orderId,
        value: amount,
        ok: result.ok,
      } as Prisma.InputJsonValue,
    },
  });
}

async function markGoogleAdsSkip(
  conversionId: string,
  code: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await systemPrisma.conversion.update({
    where: { id: conversionId },
    data: {
      googleAdsSync: code,
      googleAdsSyncedAt: new Date(),
      googleAdsSyncDetail: detail as Prisma.InputJsonValue,
    },
  });
}

export type UploadConversionRetractionParams = {
  customerId: string;
  conversionActionId: string;
  loginCustomerId?: string | null;
  orderId: string;
  adjustmentDateTime: Date;
  /** Fallback se a API exigir gclid + data da conversão original. */
  gclid?: string | null;
  originalConversionDateTime?: Date | null;
};

/**
 * RETRACTION no Google Ads (refund/chargeback) — remove a conversão offline correspondente ao order_id.
 */
export async function uploadConversionRetractionToGoogleAds(
  creds: GoogleAdsApiCredentials,
  params: UploadConversionRetractionParams,
): Promise<UploadClickConversionResult> {
  const customerId = onlyDigits(params.customerId);
  const actionId = params.conversionActionId.replace(/\D/g, "");
  const login = onlyDigits(params.loginCustomerId ?? undefined);
  const orderId = params.orderId.trim().slice(0, 200);

  if (!customerId || !DIGITS_ONLY.test(customerId)) {
    return { ok: false, error: "google_ads_customer_id inválido" };
  }
  if (!actionId) {
    return { ok: false, error: "google_ads_conversion_action_id inválido" };
  }
  if (!orderId) {
    return { ok: false, error: "order_id em falta para retraction" };
  }

  const client = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });

  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: creds.refreshToken,
    ...(login ? { login_customer_id: login } : {}),
  });

  const conversion_action = ResourceNames.conversionAction(customerId, actionId);
  const adjustment: Record<string, unknown> = {
    adjustment_type: enums.ConversionAdjustmentType.RETRACTION,
    conversion_action,
    adjustment_date_time: formatGoogleAdsConversionDateTime(params.adjustmentDateTime),
    order_id: orderId,
  };
  if (params.gclid?.trim() && params.originalConversionDateTime) {
    adjustment.gclid_date_time_pair = {
      gclid: params.gclid.trim(),
      conversion_date_time: formatGoogleAdsConversionDateTime(params.originalConversionDateTime),
    };
  }

  const request = new services.UploadConversionAdjustmentsRequest({
    customer_id: customerId,
    partial_failure: true,
    conversion_adjustments: [adjustment],
  });

  try {
    const response = await customer.conversionAdjustmentUploads.uploadConversionAdjustments(request);
    const serial = safeSerializeGoogleAdsResponse(response);
    const partial = response.partial_failure_error as { message?: string; details?: unknown[] } | null | undefined;
    if (partial && (partial.message || (partial.details && partial.details.length))) {
      const msg = partial.message || JSON.stringify(partial.details?.[0] ?? partial);
      return { ok: false, error: msg.slice(0, 2000), raw: serial };
    }
    return { ok: true, raw: serial };
  } catch (e) {
    const msg = plainGoogleAdsError(e);
    return { ok: false, error: msg, raw: e };
  }
}

/**
 * Após marcar Conversion como refunded: envia RETRACTION ao Google Ads se a venda tinha sido enviada.
 */
export async function retractConversionFromGoogleAds(conversionId: string): Promise<void> {
  const conv = await systemPrisma.conversion.findUnique({
    where: { id: conversionId },
    include: { click: true, user: true },
  });
  if (!conv || conv.status !== "refunded") return;

  const detail = (conv.googleAdsSyncDetail || {}) as Record<string, unknown>;
  if (detail.retraction === "sent" || conv.googleAdsSync === "retracted") return;

  const user = conv.user;
  if (!user.googleAdsEnabled) return;

  const customerId = onlyDigits(user.googleAdsCustomerId);
  const actionId = user.googleAdsConversionActionId?.trim();
  if (!customerId || !actionId) return;

  const creds = buildGoogleAdsCredentialsForUser(user);
  if (!creds) return;

  /** Só retracta se a conversão chegou a ser enviada (ou tenta sempre com order_id — Google ignora se não existir). */
  if (conv.googleAdsSync !== "sent" && conv.googleAdsSync !== "failed") {
    await systemPrisma.conversion.update({
      where: { id: conv.id },
      data: {
        googleAdsSyncDetail: {
          ...detail,
          retraction: "skipped_never_uploaded",
        } as Prisma.InputJsonValue,
      },
    });
    return;
  }

  const flat = stringFieldsFromJson(conv.metadata);
  const orderId = conv.externalOrderId?.trim() || pickOrderIdFromPayload(flat) || conv.id;
  const meta = (conv.click?.metadata || {}) as Record<string, unknown>;
  const gclid = typeof meta.gclid === "string" ? meta.gclid : null;
  const loginCustomerId = onlyDigits(user.googleAdsLoginCustomerId);

  const result = await uploadConversionRetractionToGoogleAds(creds, {
    customerId,
    conversionActionId: actionId,
    loginCustomerId,
    orderId,
    adjustmentDateTime: new Date(),
    gclid,
    originalConversionDateTime: conv.createdAt,
  });

  await systemPrisma.conversion.update({
    where: { id: conv.id },
    data: {
      googleAdsSync: result.ok ? "retracted" : conv.googleAdsSync,
      googleAdsSyncedAt: new Date(),
      googleAdsSyncDetail: {
        ...detail,
        retraction: result.ok ? "sent" : "failed",
        retraction_error: result.ok ? undefined : result.error,
        retraction_raw: result.raw,
      } as Prisma.InputJsonValue,
    },
  });

  await systemPrisma.postbackLog.create({
    data: {
      userId: user.id,
      presellPageId: conv.presellId,
      platform: "google_ads_conversion_retraction",
      status: result.ok ? "success" : "error",
      message: result.ok ? "Google Ads RETRACTION OK" : (result.error || "fail").slice(0, 500),
      payload: {
        conversion_id: conv.id,
        order_id: orderId,
        ok: result.ok,
      } as Prisma.InputJsonValue,
    },
  });
}

const CLICKORA_OFFLINE_ACTION_NAME = "Clickora Offline (GCLID)";

export type GoogleAdsBootstrapResult = {
  ok: boolean;
  customer_id: string | null;
  login_customer_id: string | null;
  conversion_action_id: string | null;
  conversion_action_created: boolean;
  enabled: boolean;
  can_upload: boolean;
  accounts_found: number;
  detail: string;
};

/**
 * Após OAuth: escolhe conta Ads, garante ação UPLOAD_CLICKS, activa importação automática.
 * Minimiza passos manuais no Google Ads UI.
 */
type AdsProbeClient = {
  Customer: (opts: { customer_id: string; refresh_token: string; login_customer_id?: string }) => {
    query: (gaql: string) => Promise<unknown>;
  };
};

type ProbedAdsAccount = { id: string; name: string; kind: "manager" | "direct" | "needs_manager" | "unknown" };

function managerLoginRequired(err: unknown): boolean {
  const text = plainGoogleAdsError(err).toLowerCase();
  return (
    text.includes("login-customer-id") ||
    text.includes("permission to access customer") ||
    text.includes("user doesn't have permission") ||
    text.includes("permission_denied")
  );
}

async function readCustomerProbe(
  client: AdsProbeClient,
  refreshToken: string,
  id: string,
  loginCustomerId?: string,
): Promise<{ name: string; manager: boolean }> {
  const customer = client.Customer({
    customer_id: id,
    refresh_token: refreshToken,
    ...(loginCustomerId ? { login_customer_id: loginCustomerId } : {}),
  });
  const rows = (await customer.query(`
    SELECT customer.id, customer.descriptive_name, customer.manager
    FROM customer
    LIMIT 1
  `)) as Array<{ customer?: { descriptive_name?: string; manager?: boolean } }>;
  const cust = rows?.[0]?.customer;
  return {
    name: cust?.descriptive_name?.trim() || id,
    manager: cust?.manager === true,
  };
}

async function probeGoogleAdsAccounts(
  client: AdsProbeClient,
  refreshToken: string,
  ids: string[],
): Promise<ProbedAdsAccount[]> {
  const accounts: ProbedAdsAccount[] = [];
  for (const id of ids) {
    try {
      const row = await readCustomerProbe(client, refreshToken, id);
      accounts.push({ id, name: row.name, kind: row.manager ? "manager" : "direct" });
    } catch (e) {
      if (!managerLoginRequired(e)) {
        accounts.push({ id, name: id, kind: "unknown" });
        continue;
      }
      try {
        // Uma MCC muitas vezes só responde se o login-customer-id for o próprio ID.
        const row = await readCustomerProbe(client, refreshToken, id, id);
        if (row.manager) {
          accounts.push({ id, name: row.name, kind: "manager" });
        } else {
          accounts.push({ id, name: row.name, kind: "needs_manager" });
        }
      } catch {
        accounts.push({ id, name: id, kind: "needs_manager" });
      }
    }
  }
  return accounts;
}

async function managerLoginForClient(
  client: AdsProbeClient,
  refreshToken: string,
  clientId: string,
  managers: ProbedAdsAccount[],
): Promise<string | null> {
  if (managers.length === 1) return managers[0]!.id;
  for (const manager of managers) {
    try {
      const customer = client.Customer({
        customer_id: clientId,
        refresh_token: refreshToken,
        login_customer_id: manager.id,
      });
      await customer.query(`SELECT customer.id FROM customer LIMIT 1`);
      return manager.id;
    } catch {
      /* tenta a gestora seguinte */
    }
  }
  return null;
}

export async function bootstrapGoogleAdsAfterOAuth(userId: string): Promise<GoogleAdsBootstrapResult> {
  const empty = (detail: string): GoogleAdsBootstrapResult => ({
    ok: false,
    customer_id: null,
    login_customer_id: null,
    conversion_action_id: null,
    conversion_action_created: false,
    enabled: false,
    can_upload: false,
    accounts_found: 0,
    detail,
  });

  const user = await systemPrisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAdsEnabled: true,
      googleAdsCustomerId: true,
      googleAdsConversionActionId: true,
      googleAdsLoginCustomerId: true,
      googleAdsRefreshToken: true,
    },
  });
  if (!user) return empty("user_not_found");

  const creds = buildGoogleAdsCredentialsForUser(user);
  if (!creds) return empty("oauth_or_server_config_missing");

  const client = new GoogleAdsApi({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    developer_token: creds.developerToken,
  });

  let resourceNames: string[] = [];
  try {
    const listed = await client.listAccessibleCustomers(creds.refreshToken);
    if (Array.isArray(listed)) {
      resourceNames = listed as string[];
    } else if (listed && typeof listed === "object") {
      const rn = (listed as { resource_names?: unknown }).resource_names;
      if (Array.isArray(rn)) resourceNames = rn.map(String);
    }
  } catch (e) {
    const msg = plainGoogleAdsError(e);
    return empty(`list_accounts_failed: ${humanizeGoogleAdsApiError(msg)}`);
  }

  const accessibleIds = resourceNames
    .map((r) => {
      const m = /customers\/(\d+)/.exec(r);
      return m?.[1] ?? null;
    })
    .filter((x): x is string => Boolean(x));

  if (accessibleIds.length === 0) {
    return empty("Nenhuma conta Google Ads acessível com este login.");
  }

  const accounts = await probeGoogleAdsAccounts(client, creds.refreshToken, accessibleIds.slice(0, 25));

  let loginCustomerId: string | null = onlyDigits(user.googleAdsLoginCustomerId);
  let customerId: string | null = onlyDigits(user.googleAdsCustomerId);
  const managers = accounts.filter((a) => a.kind === "manager");
  const clients = accounts.filter((a) => a.kind === "direct" || a.kind === "needs_manager");

  if (customerId && !accounts.some((account) => account.id === customerId)) {
    customerId = null;
    loginCustomerId = null;
    await systemPrisma.user.update({
      where: { id: userId },
      data: { googleAdsCustomerId: null, googleAdsLoginCustomerId: null },
    });
  }

  if (!customerId) {
    if (clients.length > 1) {
      return {
        ok: false,
        customer_id: null,
        login_customer_id: loginCustomerId,
        conversion_action_id: null,
        conversion_action_created: false,
        enabled: false,
        can_upload: false,
        accounts_found: accounts.length,
        detail: `Encontrámos várias contas de anúncios (${clients.map((account) => account.id).join(", ")}). Indique o número da conta e use «Actualizar ligação».`,
      };
    }
    if (clients.length === 1) {
      customerId = clients[0]!.id;
      if (!loginCustomerId && clients[0]!.kind === "needs_manager") {
        loginCustomerId = await managerLoginForClient(client, creds.refreshToken, customerId, managers);
      }
    } else {
      const manager = accounts[0]!;
      loginCustomerId = manager.id;
      try {
        const mc = client.Customer({
          customer_id: manager.id,
          refresh_token: creds.refreshToken,
          login_customer_id: manager.id,
        });
        const clients = await mc.query(`
          SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.manager, customer_client.status
          FROM customer_client
          WHERE customer_client.status = 'ENABLED'
          LIMIT 40
        `);
        const list = Array.isArray(clients) ? clients : [];
        for (const row of list) {
          const cc = row.customer_client as {
            client_customer?: string;
            manager?: boolean;
            descriptive_name?: string;
          };
          if (cc?.manager) continue;
          const m = /customers\/(\d+)/.exec(String(cc?.client_customer || ""));
          if (m?.[1]) {
            customerId = m[1];
            break;
          }
        }
      } catch (e) {
        console.warn("[bootstrapGoogleAdsAfterOAuth] customer_client", e);
      }
      if (!customerId) {
        return {
          ...empty(
            "Ligou uma conta que gere outras, mas não há conta de anúncios acessível. Escolha a conta onde estão os anúncios e volte a ligar.",
          ),
          accounts_found: accounts.length,
          login_customer_id: loginCustomerId,
        };
      }
    }
  }

  const chosen = accounts.find((a) => a.id === customerId);
  if (chosen?.kind === "direct") {
    loginCustomerId = null;
  } else if (customerId && !loginCustomerId && chosen?.kind === "needs_manager") {
    loginCustomerId = await managerLoginForClient(client, creds.refreshToken, customerId, managers);
  }

  const loginAttempts: Array<string | null> = [];
  const pushLogin = (id: string | null) => {
    if (loginAttempts.some((item) => item === id)) return;
    loginAttempts.push(id);
  };
  if (chosen?.kind === "needs_manager" || chosen?.kind === "unknown") {
    for (const manager of managers) pushLogin(manager.id);
    for (const other of accounts) {
      if (other.id !== customerId) pushLogin(other.id);
    }
    pushLogin(loginCustomerId);
  } else {
    pushLogin(loginCustomerId);
    for (const manager of managers) pushLogin(manager.id);
    for (const other of accounts) {
      if (other.id !== customerId) pushLogin(other.id);
    }
  }

  let customer = client.Customer({
    customer_id: customerId!,
    refresh_token: creds.refreshToken,
    ...(loginAttempts[0] ? { login_customer_id: loginAttempts[0] } : {}),
  });

  let conversionActionId = onlyDigits(user.googleAdsConversionActionId);
  let conversionActionCreated = false;
  let conversionError: unknown = null;

  for (const attempt of loginAttempts) {
    customer = client.Customer({
      customer_id: customerId!,
      refresh_token: creds.refreshToken,
      ...(attempt ? { login_customer_id: attempt } : {}),
    });
    loginCustomerId = attempt;
    try {
      const actions = await customer.query(`
      SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.type,
        conversion_action.status
      FROM conversion_action
      WHERE conversion_action.type = 'UPLOAD_CLICKS'
        AND conversion_action.status != 'REMOVED'
      ORDER BY conversion_action.id
      LIMIT 50
    `);
    const list = Array.isArray(actions) ? actions : [];
    type ActionRow = { id: string; name: string };
    const parsed: ActionRow[] = [];
    for (const row of list) {
      const a = row.conversion_action as { id?: unknown; name?: string; status?: string } | undefined;
      const id = onlyDigits(String(a?.id ?? ""));
      if (!id) continue;
      parsed.push({ id, name: a?.name?.trim() || id });
    }
    const prefer =
      parsed.find((a) => a.name.toLowerCase().includes("clickora")) ||
      parsed.find((a) => /offline|upload|gclid|import/i.test(a.name)) ||
      parsed[0];
    if (prefer) {
      conversionActionId = prefer.id;
    } else {
      const created = await customer.conversionActions.create([
        {
          name: CLICKORA_OFFLINE_ACTION_NAME,
          type: enums.ConversionActionType.UPLOAD_CLICKS,
          category: enums.ConversionActionCategory.PURCHASE,
          status: enums.ConversionActionStatus.ENABLED,
          click_through_lookback_window_days: 30,
          value_settings: {
            default_value: 0,
            always_use_default_value: false,
          },
        },
      ]);
      const results = (created as { results?: Array<{ resource_name?: string }> })?.results;
      const rn = results?.[0]?.resource_name || "";
      const m = /conversionActions\/(\d+)/.exec(rn);
      if (!m?.[1]) {
        return {
          ...empty("Não foi possível criar a ação de conversão offline na conta Google Ads."),
          accounts_found: accounts.length,
          customer_id: customerId,
          login_customer_id: loginCustomerId,
        };
      }
      conversionActionId = m[1];
      conversionActionCreated = true;
    }
      conversionError = null;
      break;
    } catch (e) {
      conversionError = e;
      if (!managerLoginRequired(e)) break;
    }
  }

  if (conversionError) {
    const msg = plainGoogleAdsError(conversionError);
    const others = accounts.filter((a) => a.id !== customerId);
    const visible = accounts.map((a) => a.id).join(", ") || "nenhuma";
    const seen = accounts.some((a) => a.id === customerId);
    const hint = !seen
      ? ` A conta ${customerId} não está na conta Google que ligou. Contas que esta autorização vê: ${visible}.`
      : others.length > 0
        ? ` Esta autorização vê mais ${others.length} conta(s) e nenhuma permitiu a leitura. Contas: ${visible}.`
        : " Esta autorização só vê esta conta. Se os anúncios estão numa conta gerida por outra, indique o número dessa conta gestora.";
    return {
      ...empty(`${humanizeGoogleAdsApiError(msg)}${hint}`),
      accounts_found: accounts.length,
      customer_id: customerId,
      login_customer_id: loginCustomerId,
    };
  }

  const updated = await systemPrisma.user.update({
    where: { id: userId },
    data: {
      googleAdsCustomerId: customerId,
      googleAdsLoginCustomerId: loginCustomerId,
      googleAdsConversionActionId: conversionActionId,
      googleAdsEnabled: true,
    },
    select: {
      googleAdsEnabled: true,
      googleAdsCustomerId: true,
      googleAdsConversionActionId: true,
      googleAdsLoginCustomerId: true,
      googleAdsRefreshToken: true,
    },
  });

  return {
    ok: true,
    customer_id: customerId,
    login_customer_id: loginCustomerId,
    conversion_action_id: conversionActionId,
    conversion_action_created: conversionActionCreated,
    enabled: true,
    can_upload: isGoogleAdsClickUploadReadyForUser(updated),
    accounts_found: accounts.length,
    detail: `Conta ${customerId}${
      loginCustomerId ? `. Conta gestora ${loginCustomerId}` : ". Conta gestora não indicada"
    }. O envio das vendas está activo.`,
  };
}
