/**
 * Keyword Ideas (Planejador Google) com as credenciais Google Ads do afiliado (conta User).
 * Sem custo de fornecedor terceiro — só a API oficial já usada na app.
 */
import {
  API_BASE,
  getAccessFromRefreshToken,
  resolveDeveloperTokenHeader,
} from "../../paid/google-ads.api";
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
  parseKeywordIdeasPages,
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
  /** Como o Planejador UI: janela em meses completos (exclui o mês corrente incompleto). */
  const end = addCalendarMonths(now.getFullYear(), now.getMonth() + 1, -1);
  const start = addCalendarMonths(end.year, end.month, -timeframeSpanMonths(timeframe));
  return {
    yearMonthRange: {
      start: { year: start.year, month: monthNumToGoogleEnum(start.month) },
      end: { year: end.year, month: monthNumToGoogleEnum(end.month) },
    },
    includeAverageCpc: true,
  };
}

function extractAdsErrorDetail(text: string): { message: string; codes: string[] } {
  try {
    const errJson = JSON.parse(text) as {
      error?: {
        message?: string;
        status?: string;
        details?: Array<{ errors?: Array<{ errorCode?: Record<string, string>; message?: string }> }>;
      };
    };
    const codes: string[] = [];
    const details = errJson.error?.details ?? [];
    for (const d of details) {
      for (const e of d.errors ?? []) {
        const ec = e.errorCode;
        if (ec && typeof ec === "object") {
          for (const v of Object.values(ec)) {
            if (typeof v === "string" && v && v !== "UNSPECIFIED") codes.push(v);
          }
        }
      }
    }
    const message = errJson.error?.message?.trim() || codes[0] || "";
    return { message: message.slice(0, 220), codes };
  } catch {
    return { message: "", codes: [] };
  }
}

function uniqueIds(ids: Array<string | null | undefined>): Array<string | null> {
  const out: Array<string | null> = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const key = raw == null || raw === "" ? "__null__" : raw;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw == null || raw === "" ? null : raw);
  }
  return out;
}

type KeywordIdeasAttempt =
  | {
      ok: true;
      status: number;
      text: string;
      customerId: string;
      loginCustomerId: string | null;
      /** Body exacto do pedido vencedor — obrigatório para paginar sem desalinhamento. */
      requestBody: Record<string, unknown>;
    }
  | { ok: false; status: number; text: string };

/**
 * Conta privada: sem header login-customer-id.
 * MCC: tenta primeiro sem login, depois o gestor guardado (nunca o MCC global do servidor).
 */
async function generateKeywordIdeasWithFallbacks(input: {
  access: string;
  developerToken: string;
  preferredCustomerId: string;
  preferredLogin: string | null;
  /** true = conta privada (sem MCC) — só pedidos sem login-customer-id */
  privateAccount: boolean;
  bodies: Record<string, unknown>[];
}): Promise<KeywordIdeasAttempt> {
  const accessible = await listAccessibleCustomerIds(input.access, input.developerToken);
  const managerLogins = input.privateAccount
    ? []
    : accessible.filter((id) => id !== input.preferredCustomerId).slice(0, 4);
  /** Sempre null primeiro — contas privadas e MCC mal configurado não devem começar com login errado. */
  const loginCandidates = input.privateAccount
    ? ([null] as Array<string | null>)
    : uniqueIds([null, input.preferredLogin, ...managerLogins]);
  const altCustomers = accessible
    .filter((id) => id !== input.preferredCustomerId)
    .slice(0, 3);

  let lastFail: { status: number; text: string } = { status: 0, text: "" };
  let attempts = 0;
  const maxAttempts = 18;

  async function tryPair(
    operatingCustomer: string,
    login: string | null,
    body: Record<string, unknown>,
  ): Promise<KeywordIdeasAttempt | null> {
    if (attempts >= maxAttempts) return { ok: false, ...lastFail };
    attempts += 1;
    const result = await postKeywordIdeas({
      access: input.access,
      developerToken: input.developerToken,
      customerId: operatingCustomer,
      loginCustomerId: login,
      body,
    });
    if (result.ok) {
      return {
        ok: true,
        status: result.status,
        text: result.text,
        customerId: operatingCustomer,
        loginCustomerId: login,
        requestBody: body,
      };
    }
    lastFail = { status: result.status, text: result.text };
    if (result.status === 404) return { ok: false, ...lastFail };
    return null;
  }

  for (const body of input.bodies) {
    for (const login of loginCandidates) {
      const hit = await tryPair(input.preferredCustomerId, login, body);
      if (hit) return hit;
    }
  }

  const authFail = lastFail.status === 401 || lastFail.status === 403;
  if (authFail && altCustomers.length) {
    for (const body of input.bodies.slice(0, 2)) {
      for (const operatingCustomer of altCustomers) {
        const loginsForAlt = input.privateAccount
          ? ([null] as Array<string | null>)
          : uniqueIds([null, input.preferredLogin, ...managerLogins]).slice(0, 3);
        for (const login of loginsForAlt) {
          const hit = await tryPair(operatingCustomer, login, body);
          if (hit) return hit;
        }
      }
    }
  }

  return { ok: false, ...lastFail };
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
        ? "A conta pode estar ligada em Integrações, mas este servidor não tem GOOGLE_ADS_CLIENT_ID / CLIENT_SECRET. Sem isso o Planejador não devolve volumes."
        : (block?.message ??
          "Ligue o Google Ads em Integrações para ver volumes oficiais do Planejador de palavras-chave.");
    return unavailable(reason, message);
  }

  const creds = buildGoogleAdsCredentialsForUser(input.user);
  const dev = resolveDeveloperTokenHeader();
  if (!creds) {
    return unavailable(
      "google_ads_api_not_configured",
      "A API Google Ads ainda não está configurada neste servidor (OAuth do projecto Cloud).",
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
   * Conta privada: sem login-customer-id (header omitido).
   * Se o utilizador tiver o mesmo ID em customer e gestor, trata-se como privada.
   * MCC só quando login ≠ customer — NUNCA o GOOGLE_ADS_LOGIN_CUSTOMER_ID global do servidor.
   */
  const storedLogin = onlyDigits(input.user.googleAdsLoginCustomerId);
  const preferredLogin =
    storedLogin && storedLogin !== customerId ? storedLogin : null;
  const privateAccount = preferredLogin == null;
  const pageSize = Math.min(100, Math.max(20, input.limit ?? 40));

  const baseBody: Record<string, unknown> = {
    language: `languageConstants/${langNum}`,
    geoTargetConstants: [`geoTargetConstants/${geoId}`],
    keywordPlanNetwork: "GOOGLE_SEARCH",
    includeAdultKeywords: false,
    keywordSeed: { keywords: [seed] },
    pageSize,
    historicalMetricsOptions: historicalMetricsOptions(timeframe),
  };

  /** Pedido mínimo primeiro — DEVICE/aggregate por vezes falha e bloqueava tudo. */
  const bareBody: Record<string, unknown> = {
    language: `languageConstants/${langNum}`,
    geoTargetConstants: [`geoTargetConstants/${geoId}`],
    keywordPlanNetwork: "GOOGLE_SEARCH",
    includeAdultKeywords: false,
    keywordSeed: { keywords: [seed] },
    pageSize,
  };

  const withDevices = {
    ...baseBody,
    aggregateMetrics: { aggregateMetricTypes: ["DEVICE"] },
  };
  /** Variante sem historicalMetrics — alguns clientes só devolvem DEVICE neste formato. */
  const withDevicesBare = {
    ...bareBody,
    aggregateMetrics: { aggregateMetricTypes: ["DEVICE"] },
  };

  const result = await generateKeywordIdeasWithFallbacks({
    access,
    developerToken: dev,
    preferredCustomerId: customerId,
    preferredLogin,
    privateAccount,
    /** Preferir DEVICE cedo; se falhar, base/bare ainda salvam volume/CPC. */
    bodies: [withDevices, baseBody, bareBody, withDevicesBare],
  });

  if (!result.ok) {
    if (result.status === 0) {
      return unavailable("api_error", "Falha de rede ao contactar a API Google Ads.");
    }
    const { message, codes } = extractAdsErrorDetail(result.text);
    const detail = message ? `: ${message}` : "";
    const codeHint = codes.length ? ` [${codes.slice(0, 3).join(", ")}]` : "";
    if (
      result.status === 403 ||
      codes.includes("USER_PERMISSION_DENIED") ||
      codes.includes("SERVICE_ACCESS_DENIED") ||
      codes.includes("DEVELOPER_TOKEN_NOT_APPROVED")
    ) {
      if (
        codes.includes("DEVELOPER_TOKEN_NOT_APPROVED") ||
        codes.includes("CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION")
      ) {
        return unavailable(
          "permission_denied",
          "O projecto Google Cloud da Clickora ainda não tem acesso Basic à API Ads para o Planejador (KeywordPlanIdeaService). Tokens de developer foram descontinuados: em Cloud Console → Google Ads API → Níveis de acesso, confirme Exploração e peça Básico (exige verificação de marca OAuth). A sua conta e o OAuth estão OK — o bloqueio é no nível de acesso do projecto. Nada é inventado entretanto.",
        );
      }
      const explorerHint = codes.includes("SERVICE_ACCESS_DENIED")
        ? " O projecto Google Cloud da Clickora pode estar em Explorer — KeywordPlanIdeaService exige Basic+."
        : "";
      const accountHint = privateAccount
        ? " Conta privada: pedido sem login-customer-id."
        : " Se usa MCC, confirme o login-customer-id do gestor em Integrações.";
      return unavailable(
        "permission_denied",
        `Sem permissão na API do Planejador (${result.status})${detail}${codeHint}.${accountHint}${explorerHint} O site ads.google.com pode mostrar o Planejador na mesma — a API é um caminho separado. Nada é inventado.`,
      );
    }
    return unavailable(
      "api_error",
      `O Planejador Google Ads não devolveu dados (${result.status})${detail}${codeHint}`,
    );
  }

  let firstPage: Record<string, unknown>;
  try {
    firstPage = JSON.parse(result.text) as Record<string, unknown>;
  } catch {
    return unavailable("api_error", "Resposta inválida da API Google Ads.");
  }

  /** Paginação como no Ads — junta páginas até ao limite (sem inventar keywords). */
  const pages: Array<{ results?: Array<Record<string, unknown>> }> = [
    firstPage as { results?: Array<Record<string, unknown>> },
  ];
  const targetLimit = Math.min(100, Math.max(20, input.limit ?? 40));
  let nextToken =
    typeof firstPage.nextPageToken === "string"
      ? firstPage.nextPageToken
      : typeof firstPage.next_page_token === "string"
        ? firstPage.next_page_token
        : "";
  let pageGuard = 0;
  while (nextToken && pageGuard < 4) {
    pageGuard += 1;
    const more = await postKeywordIdeas({
      access,
      developerToken: dev,
      customerId: result.customerId,
      loginCustomerId: result.loginCustomerId,
      body: { ...result.requestBody, pageToken: nextToken },
    });
    if (!more.ok) break;
    try {
      const page = JSON.parse(more.text) as Record<string, unknown>;
      pages.push(page as { results?: Array<Record<string, unknown>> });
      nextToken =
        typeof page.nextPageToken === "string"
          ? page.nextPageToken
          : typeof page.next_page_token === "string"
            ? page.next_page_token
            : "";
      const soFar = pages.reduce((n, p) => n + (p.results?.length ?? 0), 0);
      if (soFar >= targetLimit) break;
    } catch {
      break;
    }
  }

  let deviceSplit = parsePlannerDeviceBreakdown(firstPage);
  /** Se o pedido vencedor não trouxe DEVICE, tenta enriquecer com o mesmo login/customer. */
  if (!deviceSplit) {
    for (const body of [withDevices, withDevicesBare]) {
      const enrich = await postKeywordIdeas({
        access,
        developerToken: dev,
        customerId: result.customerId,
        loginCustomerId: result.loginCustomerId,
        body,
      });
      if (!enrich.ok) continue;
      try {
        const enrichParsed = JSON.parse(enrich.text) as Record<string, unknown>;
        deviceSplit = parsePlannerDeviceBreakdown(enrichParsed);
        if (deviceSplit) break;
      } catch {
        /* ignore */
      }
    }
  }

  const finalized = parseKeywordIdeasPages(pages, seed, targetLimit);
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
    device_split: deviceSplit,
  };
}
