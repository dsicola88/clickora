/**
 * Keyword Ideas (Planejador Google) com as credenciais Google Ads do afiliado (conta User).
 * Sem custo de fornecedor terceiro — só a API oficial já usada na app.
 */
import { API_BASE, getAccessFromRefreshToken, getGoogleDeveloperToken } from "../../paid/google-ads.api";
import { GOOGLE_GEO_CRITERION_IDS } from "../../paid/geo-google";
import { GOOGLE_ADS_LANGUAGE_NUMERIC_ID, normalizeGoogleLanguageCode } from "../../paid/language-google";
import {
  buildGoogleAdsCredentialsForUser,
  getGoogleAdsReportingUnavailability,
  isGoogleAdsMetricsReadyForUser,
  type GoogleAdsUserSettings,
} from "../../modules/googleAds/googleAds.service";
import { onlyDigits } from "../stringPrimitives";
import {
  parseKeywordIdeasResponse,
  type DemandMonthlyVolumePoint,
  type DemandPlannerIdea,
  type PlannerPrimaryKind,
} from "./plannerParse";

export type { DemandPlannerIdea, PlannerPrimaryKind, DemandMonthlyVolumePoint };

export type DemandPlannerTimeframe = "default" | "last_24" | "last_36";

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
        | "no_ideas";
      message: string;
      ideas: [];
      seed_match: null;
      primary: null;
      primary_kind: null;
      trend: null;
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

function historicalMetricsOptions(timeframe: DemandPlannerTimeframe): Record<string, unknown> | null {
  if (timeframe !== "last_24" && timeframe !== "last_36") return null;
  const now = new Date();
  const end = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const span = timeframe === "last_24" ? 23 : 35;
  const start = addCalendarMonths(end.year, end.month, -span);
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
  };
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
    return unavailable(
      (block?.code as
        | "google_ads_platform_not_configured"
        | "google_ads_oauth_required"
        | "google_ads_customer_id_required"
        | undefined) ?? "google_ads_not_connected",
      block?.message ??
        "Ligue o Google Ads em Integrações para ver volumes oficiais do Planejador de palavras-chave.",
    );
  }

  const creds = buildGoogleAdsCredentialsForUser(input.user);
  const dev = getGoogleDeveloperToken();
  if (!creds || !dev) {
    return unavailable(
      "google_ads_api_not_configured",
      "A API Google Ads ainda não está configurada neste servidor.",
    );
  }

  const country = String(input.countryCode || "").trim().toUpperCase();
  const geoId = GOOGLE_GEO_CRITERION_IDS[country];
  const langIso = normalizeGoogleLanguageCode(input.languageCode) ?? "en";
  const langNum = GOOGLE_ADS_LANGUAGE_NUMERIC_ID[langIso];
  if (geoId == null || langNum == null) {
    return unavailable(
      "unsupported_geo_or_language",
      "País ou idioma sem critério no Planejador Google Ads.",
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

  const login =
    onlyDigits(input.user.googleAdsLoginCustomerId) ||
    onlyDigits(creds.loginCustomerId) ||
    onlyDigits(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${access}`,
    "developer-token": dev,
    "Content-Type": "application/json",
  };
  if (login && login !== customerId) {
    headers["login-customer-id"] = login;
  }

  const reqBody: Record<string, unknown> = {
    language: `languageConstants/${langNum}`,
    geoTargetConstants: [`geoTargetConstants/${geoId}`],
    keywordPlanNetwork: "GOOGLE_SEARCH",
    keywordSeed: { keywords: [seed] },
  };
  const hist = historicalMetricsOptions(timeframe);
  if (hist) reqBody.historicalMetricsOptions = hist;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/customers/${customerId}:generateKeywordIdeas`, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody),
    });
  } catch {
    return unavailable("api_error", "Falha de rede ao contactar a API Google Ads.");
  }

  const rawText = await res.text();
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = JSON.parse(rawText) as { error?: { message?: string } };
      detail = errJson.error?.message?.trim() ? `: ${errJson.error.message.trim().slice(0, 180)}` : "";
    } catch {
      /* ignore */
    }
    return unavailable(
      "api_error",
      `O Planejador Google Ads não devolveu dados (${res.status})${detail}`,
    );
  }

  let parsed: { results?: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(rawText) as { results?: Array<Record<string, unknown>> };
  } catch {
    return unavailable("api_error", "Resposta inválida da API Google Ads.");
  }

  const finalized = parseKeywordIdeasResponse(parsed, seed, input.limit ?? 20);
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
  };
}
