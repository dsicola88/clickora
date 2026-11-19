/**
 * Contexto OAuth Google Ads do projecto Paid — partilhado por overview, métricas e mutações.
 * Preferência: token Paid; se falhar, cura com o refresh de Integrações (mesma conta).
 */
import { resolveUserGoogleAdsRefreshToken } from "../modules/googleAds/googleAds.service";
import { getAccessFromRefreshToken, getGoogleDeveloperToken } from "./google-ads.api";
import { prisma } from "./paidPrisma";
import { loadPaidToken, storePaidToken } from "./tokenSecrets";

export const GOOGLE_ADS_LOGIN_CUSTOMER_ID =
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/\D/g, "") || undefined;

export type GoogleAdsAccessOk = {
  ok: true;
  access: string;
  customerId: string;
  /** MCC / login-customer-id do utilizador (Integrações) ou env. */
  loginCustomerId: string | undefined;
  dev: string;
  accountName: string | null;
  connectionId: string;
};

export type GoogleAdsAccessErr = { ok: false; error: string; code: string };

export type GoogleAdsAccessCtx = GoogleAdsAccessOk | GoogleAdsAccessErr;

export async function resolveGoogleAdsAccess(projectId: string): Promise<GoogleAdsAccessCtx> {
  const conn = await prisma.paidAdsGoogleAdsConnection.findUnique({ where: { projectId } });
  if (!conn || conn.status !== "connected" || !conn.tokenRef || !conn.googleCustomerId) {
    return {
      ok: false,
      error: "Conta Google por sincronizar. Em Conta, use a ligação de Integrações (um clique).",
      code: "oauth_required",
    };
  }

  const owner = await prisma.user.findUnique({
    where: { id: conn.userId },
    select: {
      googleAdsRefreshToken: true,
      googleAdsLoginCustomerId: true,
      googleAdsCustomerId: true,
    },
  });

  /** Conta cliente escolhida em Integrações — fonte de verdade (não a 1.ª acessível do OAuth Paid). */
  const integrationsCid = (owner?.googleAdsCustomerId ?? "").replace(/\D/g, "");
  let customerDigits = conn.googleCustomerId.replace(/\D/g, "");
  let accountName = conn.accountName;

  if (integrationsCid && integrationsCid !== customerDigits) {
    await prisma.paidAdsGoogleAdsConnection.update({
      where: { id: conn.id },
      data: {
        googleCustomerId: integrationsCid,
        accountName: `Conta ${integrationsCid}`,
        lastSyncAt: new Date(),
        errorMessage: null,
        status: "connected",
      },
    });
    customerDigits = integrationsCid;
    accountName = `Conta ${integrationsCid}`;
  }

  /** Só MCC do utilizador — o env global partilhado entre contas causa «invalid argument». */
  const rawLogin = owner?.googleAdsLoginCustomerId?.replace(/\D/g, "") || undefined;
  const loginCustomerId =
    rawLogin && rawLogin !== customerDigits ? rawLogin : undefined;

  /** Pós-sunset a API aceita header vazio; preferimos env quando existir. */
  const dev = getGoogleDeveloperToken() ?? "";

  const tryRefresh = async (refresh: string): Promise<string | null> => {
    try {
      const { access_token } = await getAccessFromRefreshToken(refresh);
      return access_token;
    } catch {
      return null;
    }
  };

  let refresh = loadPaidToken(conn.tokenRef);
  let access = refresh ? await tryRefresh(refresh) : null;
  let lastErr =
    "A ligação Google expirou (invalid_grant). Em Integrações → Google use «Mudar de conta» e aceite o acesso.";

  if (!access) {
    const fromIntegrations = owner ? resolveUserGoogleAdsRefreshToken(owner) : null;
    if (fromIntegrations && fromIntegrations !== refresh) {
      access = await tryRefresh(fromIntegrations);
      if (access) {
        refresh = fromIntegrations;
        await prisma.paidAdsGoogleAdsConnection.update({
          where: { id: conn.id },
          data: {
            tokenRef: storePaidToken(fromIntegrations),
            lastSyncAt: new Date(),
            errorMessage: null,
            status: "connected",
          },
        });
      } else {
        lastErr =
          "Token Google (Integrações) inválido. Volte a ligar a conta em Integrações → Google («Mudar de conta»).";
      }
    } else if (!refresh) {
      lastErr = "Token Google em falta. Ligue a conta em Integrações → Google.";
    }
  }

  if (!access) {
    return {
      ok: false,
      error: lastErr,
      code: refresh ? "token_refresh_failed" : "token_missing",
    };
  }

  if (!customerDigits) {
    return {
      ok: false,
      error:
        "Defina o número da conta cliente Google em Integrações → Google (não use a conta MCC) e volte a sincronizar.",
      code: "customer_id_required",
    };
  }

  return {
    ok: true,
    access,
    customerId: customerDigits,
    loginCustomerId,
    dev,
    accountName,
    connectionId: conn.id,
  };
}

/** Intervalos pré-definidos → YYYY-MM-DD (UTC). */
export function resolveGoogleAdsDateRange(
  preset: string,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } | { error: string } {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  };
  const startOfMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

  switch (preset) {
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: iso(y), to: iso(y) };
    }
    case "last_7":
      return { from: iso(addDays(today, -6)), to: iso(today) };
    case "last_30":
      return { from: iso(addDays(today, -29)), to: iso(today) };
    case "this_month":
      return { from: iso(startOfMonth(today)), to: iso(today) };
    case "last_month": {
      const firstThis = startOfMonth(today);
      const lastPrev = addDays(firstThis, -1);
      const firstPrev = startOfMonth(lastPrev);
      return { from: iso(firstPrev), to: iso(lastPrev) };
    }
    case "custom": {
      const from = String(customFrom ?? "").trim().slice(0, 10);
      const to = String(customTo ?? "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return { error: "Datas personalizadas inválidas (use YYYY-MM-DD)." };
      }
      if (from > to) return { error: "A data inicial não pode ser posterior à final." };
      return { from, to };
    }
    default:
      return { from: iso(addDays(today, -6)), to: iso(today) };
  }
}

export function deriveMetricRates(m: {
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value?: number;
}) {
  const impressions = m.impressions || 0;
  const clicks = m.clicks || 0;
  const cost_micros = m.cost_micros || 0;
  const conversions = m.conversions || 0;
  const conversions_value = m.conversions_value ?? 0;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const average_cpc_micros = clicks > 0 ? Math.round(cost_micros / clicks) : 0;
  const cost_per_conversion_micros = conversions > 0 ? Math.round(cost_micros / conversions) : 0;
  const roas = cost_micros > 0 ? conversions_value / (cost_micros / 1_000_000) : 0;
  return {
    impressions,
    clicks,
    cost_micros,
    conversions,
    conversions_value,
    ctr,
    average_cpc_micros,
    cost_per_conversion_micros,
    roas,
  };
}
