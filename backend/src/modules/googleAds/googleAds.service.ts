import { GoogleAdsApi, ResourceNames, services } from "google-ads-api";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { systemPrisma } from "../../lib/prisma";
import { pickOrderIdFromPayload } from "../../lib/affiliatePostbackParsers";

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
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
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
  const fromUser = user.googleAdsRefreshToken?.trim();
  if (fromUser) return fromUser;
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
function formatGaqlDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Métricas da conta (relatórios) — não exige `googleAdsEnabled` nem ação de conversão;
 * só customer ID + OAuth + credenciais API no servidor.
 */
export function isGoogleAdsMetricsReadyForUser(user: GoogleAdsUserSettings): boolean {
  if (!getGoogleAdsApiClientConfigFromEnv()) return false;
  if (!resolveUserGoogleAdsRefreshToken(user)) return false;
  const cid = onlyDigits(user.googleAdsCustomerId);
  return Boolean(cid && DIGITS_ONLY.test(cid));
}

export type GoogleAdsAccountMetrics = {
  impressions: number;
  clicks: number;
  conversions: number;
  cost_micros: number;
};

export async function fetchGoogleAdsAccountMetrics(input: {
  user: GoogleAdsUserSettings;
  from: Date;
  to: Date;
}): Promise<{ ok: true; metrics: GoogleAdsAccountMetrics } | { ok: false; error: string }> {
  if (!isGoogleAdsMetricsReadyForUser(input.user)) {
    return { ok: false, error: "Customer ID OAuth/API em falta." };
  }
  const creds = buildGoogleAdsCredentialsForUser(input.user);
  if (!creds) return { ok: false, error: "Credenciais OAuth em falta." };

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

  const gaql = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.cost_micros
    FROM customer
    WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}'
  `;

  try {
    const rows = await customer.query(gaql);
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
    return {
      ok: true,
      metrics: { impressions, clicks, conversions, cost_micros },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 500) };
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
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, raw: e };
  }
}

function metadataAsFlat(meta: unknown): Record<string, string> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (v == null) continue;
    if (typeof v === "object") continue;
    out[k] = String(v);
  }
  return out;
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

  const user = conv.user;
  if (!user.googleAdsEnabled) {
    await markGoogleAdsSkip(conv.id, "skipped_disabled", { reason: "google_ads_enabled false" });
    return;
  }

  const customerId = onlyDigits(user.googleAdsCustomerId);
  const actionId = user.googleAdsConversionActionId?.trim();
  if (!customerId || !actionId) {
    await markGoogleAdsSkip(conv.id, "skipped_no_config", {
      reason: "customer_id ou conversion_action_id em falta",
    });
    return;
  }

  const creds = buildGoogleAdsCredentialsForUser(user);
  if (!creds) {
    await markGoogleAdsSkip(conv.id, "skipped_no_config", {
      reason:
        "Credenciais Google Ads API em falta (GOOGLE_ADS_DEVELOPER_TOKEN, CLIENT_ID, CLIENT_SECRET no .env e refresh token no utilizador ou GOOGLE_ADS_REFRESH_TOKEN)",
    });
    return;
  }

  const meta = (conv.click.metadata || {}) as Record<string, unknown>;
  const gclid = typeof meta.gclid === "string" ? meta.gclid : null;
  const gbraid = typeof meta.gbraid === "string" ? meta.gbraid : null;
  const wbraid = typeof meta.wbraid === "string" ? meta.wbraid : null;

  if (!gclid?.trim() && !gbraid?.trim() && !wbraid?.trim()) {
    await markGoogleAdsSkip(conv.id, "skipped_no_gclid", {
      reason: "Clique sem gclid/gbraid/wbraid no metadata",
    });
    return;
  }

  const flat = metadataAsFlat(conv.metadata);
  const orderId = pickOrderIdFromPayload(flat) || conv.id;
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
  }
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
