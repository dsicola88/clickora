/**
 * Keyword Ideas (Planejador Google) com as credenciais Google Ads do afiliado (conta User).
 * Sem custo de fornecedor terceiro — só a API oficial já usada na app.
 */
import { API_BASE, getAccessFromRefreshToken, getGoogleDeveloperToken } from "../../paid/google-ads.api";
import { GOOGLE_GEO_CRITERION_IDS } from "../../paid/geo-google";
import { GOOGLE_ADS_LANGUAGE_NUMERIC_ID } from "../../paid/language-google";
import { normalizePlannerLanguage, normalizePlannerMarket } from "./plannerTargeting";
import {
  buildGoogleAdsCredentialsForUser,
  getGoogleAdsReportingUnavailability,
  isGoogleAdsMetricsReadyForUser,
  type GoogleAdsUserSettings,
} from "../../modules/googleAds/googleAds.service";
import { onlyDigits } from "../stringPrimitives";
import {
  parseKeywordIdeasResponse,
  parsePlannerDeviceBreakdown,
  type DemandMonthlyVolumePoint,
  type DemandPlannerDeviceBreakdown,
  type DemandPlannerIdea,
  type PlannerPrimaryKind,
} from "./plannerParse";

export type {
  DemandPlannerIdea,
  PlannerPrimaryKind,
  DemandMonthlyVolumePoint,
  DemandPlannerDeviceBreakdown,
};

/** Janelas alinhadas ao Planejador Google Ads (UI). `default` = últimos 12 meses. */
export type DemandPlannerTimeframe =
  | "default"
  | "last_1"
  | "last_12"
  | "last_24"
  | "last_36"
  | "all_available";

export type DemandVolumeTrend = {
  source: "google_monthly";
  timeframe: DemandPlannerTimeframe;
  points: Array<{ year: number; month: number; volume: number }>;
  /** Google Keyword Planner não publica volume diário oficial. */
  day_granularity: "unavailable";
};

export type UserPlannerResult =
  | {
      status: "ok";
      source: "google_ads_keyword_planner";
      ideas: DemandPlannerIdea[];
      seed_match: DemandPlannerIdea | null;
      primary: DemandPlannerIdea;
      primary_kind: PlannerPrimaryKind;
      trend: DemandVolumeTrend;
      device_split: DemandPlannerDeviceBreakdown | null;
    }
  | {
      status: "unavailable";
      source: null;
      reason:
        | "google_ads_not_connected"
        | "google_ads_api_not_configured"
        | "google_ads_platform_not_configured"
        | "google_ads_oauth_required"
        | "google_ads_customer_id_required"
        | "unsupported_geo_or_language"
        | "empty_seed"
        | "api_error"
        | "permission_denied"
        | "no_ideas";
      message: string;
      ideas: [];
      seed_match: null;
      primary: null;
      primary_kind: null;
      trend: null;
      device_split: null;
    };

const GOOGLE_MONTH_ENUM_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

function monthNumToGoogleEnum(month: number): string {
  const m = Math.floor(Number(month));
  if (m < 1 || m > 12) return "JANUARY";
  return GOOGLE_MONTH_ENUM_NAMES[m - 1]!;
}

function addCalendarMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return { year: y, month: m };
}

/** Span em meses atrás a partir do mês corrente (como no Planejador Google). */
function timeframeSpanMonths(timeframe: DemandPlannerTimeframe): number {
  switch (timeframe) {
    case "last_1":
      return 0;
    case "last_24":
      return 23;
    case "last_36":
      return 35;
    case "all_available":
      return 47; // ~4 anos — máximo documentado no Keyword Ideas
    case "last_12":
    case "default":
    default:
      return 11;
  }
}

function historicalMetricsOptions(timeframe: DemandPlannerTimeframe): Record<string, unknown> {
  const now = new Date();
  const end = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const start = addCalendarMonths(end.year, end.month, -timeframeSpanMonths(timeframe));
  return {
    yearMonthRange: {
      start: { year: start.year, month: monthNumToGoogleEnum(start.month) },
      end: { year: end.year, month: monthNumToGoogleEnum(end.month) },
    },
    includeAverageCpc: true,
  };
}

function buildTrend(
  timeframe: DemandPlannerTimeframe,
  volumes: DemandMonthlyVolumePoint[],
): DemandVolumeTrend {
  return {
    source: "google_monthly",
    timeframe,
    points: volumes.map((p) => ({
      year: p.year,
      month: p.month,
      volume: p.monthly_searches,
    })),
    day_granularity: "unavailable",
  };
}

function unavailable(
  reason: Extract<UserPlannerResult, { status: "unavailable" }>["reason"],
  message: string,
): UserPlannerResult {
  return {
    status: "unavailable",
    source: null,
    reason,
    message,
    ideas: [],
    seed_match: null,
    primary: null,
    primary_kind: null,
    trend: null,
    device_split: null,
  };
}

async function listAccessibleCustomerIds(accessToken: string, developerToken: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { resourceNames?: string[] };
    return (j.resourceNames ?? [])
      .map((r) => {
        const m = /customers\/(\d+)/.exec(r);
        return m?.[1] ?? null;
      })
      .filter((x): x is string => Boolean(x));
  } catch {
    return [];
  }
}

async function postKeywordIdeas(input: {
  access: string;
  developerToken: string;
  customerId: string;
  loginCustomerId: string | null;
  body: Record<string, unknown>;
}): Promise<{ ok: boolean; status: number; text: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.access}`,
    "developer-token": input.developerToken,
    "Content-Type": "application/json",
  };
  if (input.loginCustomerId && input.loginCustomerId !== input.customerId) {
    headers["login-customer-id"] = input.loginCustomerId;
  }
  try {
    const res = await fetch(`${API_BASE}/customers/${input.customerId}:generateKeywordIdeas`, {
      method: "POST",
      headers,
      body: JSON.stringify(input.body),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

export async function fetchUserKeywordPlannerIdeas(input: {
  user: GoogleAdsUserSettings;
  seed: string;
  countryCode: string;
  languageCode: string;
  timeframe?: DemandPlannerTimeframe;
  limit?: number;
}): Promise<UserPlannerResult> {
  const seed = input.seed.trim().slice(0, 80);
  const timeframe: DemandPlannerTimeframe = input.timeframe ?? "default";
  if (!seed) {
    return unavailable("empty_seed", "Indique um produto ou palavra-chave para consultar o Planejador.");
  }

  if (!isGoogleAdsMetricsReadyForUser(input.user)) {
    const block = getGoogleAdsReportingUnavailability(input.user);
    const reason =
      (block?.code as
        | "google_ads_platform_not_configured"
        | "google_ads_oauth_required"
        | "google_ads_customer_id_required"
        | undefined) ?? "google_ads_not_connected";
    const message =
      reason === "google_ads_platform_not_configured"
        ? "A conta pode estar ligada em Integrações, mas este servidor não tem GOOGLE_ADS_DEVELOPER_TOKEN / CLIENT_ID / CLIENT_SECRET. Sem isso o Planejador não devolve volumes."
        : (block?.message ??
          "Ligue o Google Ads em Integrações para ver volumes oficiais do Planejador de palavras-chave.");
    return unavailable(reason, message);
  }

  const creds = buildGoogleAdsCredentialsForUser(input.user);
  const dev = getGoogleDeveloperToken();
  if (!creds || !dev) {
    return unavailable(
      "google_ads_api_not_configured",
      "A API Google Ads ainda não está configurada neste servidor.",
    );
  }

  const country = normalizePlannerMarket(input.countryCode);
  const langIso = normalizePlannerLanguage(input.languageCode);
  const geoId = country ? GOOGLE_GEO_CRITERION_IDS[country] : undefined;
  const langNum = langIso ? GOOGLE_ADS_LANGUAGE_NUMERIC_ID[langIso] : undefined;
  if (country == null || langIso == null || geoId == null || langNum == null) {
    return unavailable(
      "unsupported_geo_or_language",
      "País ou idioma sem critério no Planejador Google Ads. Escolha uma localização e idioma da lista Google.",
    );
  }

  let access: string;
  try {
    ({ access_token: access } = await getAccessFromRefreshToken(creds.refreshToken));
  } catch {
    return unavailable(
      "api_error",
      "Não foi possível renovar o token Google Ads. Volte a ligar a conta em Integrações.",
    );
  }

  const customerId = onlyDigits(input.user.googleAdsCustomerId);
  if (!customerId) {
    return unavailable("google_ads_not_connected", "Conta Google Ads sem customer ID configurado.");
  }

  /**
   * Contas privadas: sem login-customer-id (só o customer da conta).
   * MCC: usar apenas o login guardado no utilizador — NÃO o GOOGLE_ADS_LOGIN_CUSTOMER_ID
   * global do servidor (esse é da plataforma e quebra contas privadas alheias).
   */
  let login = onlyDigits(input.user.googleAdsLoginCustomerId) || null;

  const baseBody: Record<string, unknown> = {
    language: `languageConstants/${langNum}`,
    geoTargetConstants: [`geoTargetConstants/${geoId}`],
    keywordPlanNetwork: "GOOGLE_SEARCH",
    keywordSeed: { keywords: [seed] },
    pageSize: Math.min(50, Math.max(20, input.limit ?? 40)),
    historicalMetricsOptions: historicalMetricsOptions(timeframe),
  };

  const withDevices = {
    ...baseBody,
    aggregateMetrics: { aggregateMetricTypes: ["DEVICE"] },
  };

  let result = await postKeywordIdeas({
    access,
    developerToken: dev,
    customerId,
    loginCustomerId: login,
    body: withDevices,
  });

  /** Conta privada sob MCC sem login guardado: tenta um gestor acessível (só neste user). */
  if (!result.ok && (result.status === 403 || result.status === 401) && !login) {
    const ids = await listAccessibleCustomerIds(access, dev);
    const altLogin = ids.find((id) => id !== customerId) ?? null;
    if (altLogin) {
      login = altLogin;
      result = await postKeywordIdeas({
        access,
        developerToken: dev,
        customerId,
        loginCustomerId: login,
        body: withDevices,
      });
    }
  }

  /** Se DEVICE/aggregate falhar, tenta o pedido mínimo (ainda com histórico + CPC). */
  if (!result.ok && (result.status === 400 || result.status === 403)) {
    result = await postKeywordIdeas({
      access,
      developerToken: dev,
      customerId,
      loginCustomerId: login,
      body: baseBody,
    });
  }

  if (!result.ok) {
    if (result.status === 0) {
      return unavailable("api_error", "Falha de rede ao contactar a API Google Ads.");
    }
    let detail = "";
    try {
      const errJson = JSON.parse(result.text) as { error?: { message?: string } };
      detail = errJson.error?.message?.trim() ? `: ${errJson.error.message.trim().slice(0, 180)}` : "";
    } catch {
      /* ignore */
    }
    if (result.status === 403) {
      return unavailable(
        "permission_denied",
        `Sem permissão na API do Planejador (${result.status})${detail}. Contas Google Ads privadas costumam funcionar; se a conta estiver sob um MCC, ligue de novo em Integrações e confirme o ID do gestor (login-customer-id).`,
      );
    }
    return unavailable(
      "api_error",
      `O Planejador Google Ads não devolveu dados (${result.status})${detail}`,
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result.text) as Record<string, unknown>;
  } catch {
    return unavailable("api_error", "Resposta inválida da API Google Ads.");
  }

  const finalized = parseKeywordIdeasResponse(
    parsed as { results?: Array<Record<string, unknown>> },
    seed,
    input.limit ?? 40,
  );
  if (!finalized.primary || !finalized.primary_kind || !finalized.ideas.length) {
    return unavailable(
      "no_ideas",
      "O Planejador não devolveu ideias com volume para este termo neste mercado/idioma.",
    );
  }

  return {
    status: "ok",
    source: "google_ads_keyword_planner",
    ideas: finalized.ideas,
    seed_match: finalized.seed_match,
    primary: finalized.primary,
    primary_kind: finalized.primary_kind,
    trend: buildTrend(timeframe, finalized.primary.monthly_search_volumes),
    device_split: parsePlannerDeviceBreakdown(parsed),
  };
}
