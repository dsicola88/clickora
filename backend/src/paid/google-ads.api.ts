/**
 * Google Ads API (REST v16) + OAuth 2.0 — funções puras, sem Prisma.
 * @see https://developers.google.com/google-ads/api/docs/start
 */

const ADS_VERSION = "v16";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const API_BASE = `https://googleads.googleapis.com/${ADS_VERSION}`;

function getClientId() {
  return process.env.GOOGLE_ADS_CLIENT_ID?.trim() ?? process.env.GOOGLE_CLIENT_ID?.trim();
}

function getClientSecret() {
  return process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() ?? process.env.GOOGLE_CLIENT_SECRET?.trim();
}

export function getGoogleDeveloperToken(): string | undefined {
  return (
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() ??
    process.env.DEVELOPER_TOKEN?.trim() ??
    process.env.GOOGLE_DEVELOPER_TOKEN?.trim()
  );
}

export function isGoogleAdsOAuthConfigured(): boolean {
  return Boolean(getClientId() && getClientSecret() && getGoogleDeveloperToken());
}

function assertDeveloperToken(t: string | undefined): asserts t is string {
  if (!t) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN (ou DEVELOPER_TOKEN) em falta.");
  }
}

/** Evita que `res.json()` lance "Unexpected token '<'..." quando a API devolve HTML (404, proxy, HTML de erro). */
async function readJsonOrThrow(res: Response, context: string): Promise<unknown> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    const hint =
      trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")
        ? " Recebeu-se HTML em vez de JSON — confirme que a Google Ads API está ativada no projecto Google Cloud, que o developer token é válido e que o URL da API não está bloqueado."
        : "";
    throw new Error(
      `${context} (${res.status}): corpo não é JSON.${hint} (${text.slice(0, 180).replace(/\s+/g, " ")})`,
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`${context}: JSON inválido (${res.status}).`);
  }
}

export async function exchangeGoogleAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<{ refresh_token: string; access_token: string }> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET em falta.");
  }

  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const j = (await readJsonOrThrow(res, "OAuth token endpoint")) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !j.access_token) {
    throw new Error(
      j.error_description ?? j.error ?? `Falha na troca do código OAuth (${res.status}).`,
    );
  }
  if (!j.refresh_token) {
    throw new Error(
      "O Google não devolveu refresh_token. Use access_type=offline e prompt=consent e volte a autorizar.",
    );
  }
  return { access_token: j.access_token, refresh_token: j.refresh_token };
}

export async function getAccessFromRefreshToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais OAuth Google em falta.");
  }

  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const j = (await readJsonOrThrow(res, "OAuth refresh_token")) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !j.access_token) {
    throw new Error(j.error ?? `Falha ao renovar token Google (${res.status}).`);
  }
  return { access_token: j.access_token, expires_in: j.expires_in ?? 3600 };
}

export function buildGoogleOAuthAuthUrl(redirectUri: string, state: string): string {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("GOOGLE_ADS_CLIENT_ID em falta.");
  }
  const u = new URL(OAUTH_AUTH);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
  u.searchParams.set("state", state);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  return u.toString();
}

export async function listFirstAccessibleCustomerId(
  accessToken: string,
): Promise<{ customerId: string; name: string | null }> {
  const dev = getGoogleDeveloperToken();
  assertDeveloperToken(dev);

  const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": dev,
    },
  });

  const j = (await readJsonOrThrow(res, "Google Ads listAccessibleCustomers")) as {
    resourceNames?: string[];
    error?: { message?: string; status?: string };
  };

  if (!res.ok) {
    throw new Error(
      j.error?.message ??
        `Não foi possível listar contas Google Ads (${res.status}). Verifique o developer token (modo de teste vs produção).`,
    );
  }
  const first = j.resourceNames?.[0];
  if (!first) {
    throw new Error("Nenhuma conta Google Ads acessível com este utilizador.");
  }
  const match = /^customers\/(\d+)$/.exec(first);
  const customerId = match ? match[1]! : first.replace("customers/", "");
  return { customerId, name: null };
}

export async function fetchCustomerName(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<string | null> {
  const dev = getGoogleDeveloperToken();
  assertDeveloperToken(dev);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": dev,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

  const res = await fetch(`${API_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: "SELECT customer.descriptive_name, customer.id FROM customer LIMIT 1",
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    results?: Array<{ customer?: { descriptiveName?: string } }>;
  };
  const n = j.results?.[0]?.customer?.descriptiveName;
  return n ? String(n) : null;
}

function microsFromMetric(m: string | number | undefined | null): bigint {
  if (m == null) return 0n;
  const digits = String(m).replace(/\D/g, "");
  return digits ? BigInt(digits) : 0n;
}

function buildSeriesAndToday(byDate: Map<string, bigint>): {
  todayMicros: bigint;
  seriesUsd: { date: string; spendUsd: number }[];
} {
  const today = new Date().toISOString().slice(0, 10);
  const seriesUsd: { date: string; spendUsd: number }[] = [];
  const cap = 14;
  const now = new Date();
  for (let i = cap - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const micros = byDate.get(key) ?? 0n;
    seriesUsd.push({
      date: d.toLocaleDateString("pt-BR", { month: "short", day: "numeric" }),
      spendUsd: Math.round((Number(micros) / 1_000_000) * 100) / 100,
    });
  }
  const todayMicros = byDate.get(today) ?? 0n;
  return { todayMicros, seriesUsd };
}

async function fetchLast14DaysSpendFromCampaigns(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<{ todayMicros: bigint; seriesUsd: { date: string; spendUsd: number }[] }> {
  const dev = getGoogleDeveloperToken();
  assertDeveloperToken(dev);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": dev,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

  const res = await fetch(`${API_BASE}/customers/${customerId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: [
        "SELECT",
        "campaign.id,",
        "segments.date,",
        "metrics.cost_micros",
        "FROM campaign",
        "WHERE segments.date DURING LAST_14_DAYS",
      ].join(" "),
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Relatório de campanhas indisponível (${res.status}).`);
  }
  const j = (await res.json()) as {
    results?: Array<{
      segments?: { date?: string };
      metrics?: { costMicros?: string | number };
    }>;
  };
  const byDate = new Map<string, bigint>();
  for (const row of j.results ?? []) {
    const d = row.segments?.date;
    if (!d) continue;
    const m = row.metrics?.costMicros;
    const v = microsFromMetric(m);
    const prev = byDate.get(d) ?? 0n;
    byDate.set(d, prev + v);
  }
  return buildSeriesAndToday(byDate);
}

/** Gasto hoje (micros) e série dos últimos 14 dias (dólares) para o gráfico. */
export async function fetchLast14DaysSpend(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<{ todayMicros: bigint; seriesUsd: { date: string; spendUsd: number }[] }> {
  const dev = getGoogleDeveloperToken();
  assertDeveloperToken(dev);
  const cleanId = customerId.replace(/\D/g, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": dev,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = loginCustomerId;
  }

  const res = await fetch(`${API_BASE}/customers/${cleanId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: [
        "SELECT",
        "segments.date,",
        "metrics.cost_micros",
        "FROM customer",
        "WHERE",
        "segments.date",
        "DURING",
        "LAST_14_DAYS",
        "ORDER",
        "BY",
        "segments.date",
      ].join(" "),
    }),
  });

  if (!res.ok) {
    return fetchLast14DaysSpendFromCampaigns(accessToken, cleanId, loginCustomerId);
  }

  const j = (await res.json()) as {
    results?: Array<{
      segments?: { date?: string };
      metrics?: { costMicros?: string | number };
    }>;
  };

  const byDate = new Map<string, bigint>();
  for (const row of j.results ?? []) {
    const d = row.segments?.date;
    if (!d) continue;
    const m = row.metrics?.costMicros;
    const v = microsFromMetric(m);
    const prev = byDate.get(d) ?? 0n;
    byDate.set(d, prev + v);
  }

  if (byDate.size === 0) {
    return fetchLast14DaysSpendFromCampaigns(accessToken, cleanId, loginCustomerId);
  }

  return buildSeriesAndToday(byDate);
}

function headersForGoogleAds(
  accessToken: string,
  devToken: string,
  loginCustomerId?: string,
): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": devToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    h["login-customer-id"] = loginCustomerId.replace(/\D/g, "");
  }
  return h;
}

/** Consulta genérica (GAQL). */
export async function runGoogleAdsSearch(
  accessToken: string,
  customerId: string,
  devToken: string,
  query: string,
  loginCustomerId?: string,
): Promise<{ results?: unknown[]; error?: { message?: string } }> {
  assertDeveloperToken(devToken);
  const clean = customerId.replace(/\D/g, "");
  const res = await fetch(`${API_BASE}/customers/${clean}/googleAds:search`, {
    method: "POST",
    headers: headersForGoogleAds(accessToken, devToken, loginCustomerId),
    body: JSON.stringify({ query, pageSize: 500 }),
  });
  const j = (await res.json().catch(() => ({}))) as {
    results?: unknown[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return { error: { message: j.error?.message ?? `googleAds:search ${res.status}` } };
  }
  return { results: j.results };
}

export async function runGoogleAdsMutate(
  accessToken: string,
  customerId: string,
  devToken: string,
  servicePath: string,
  body: { operations: unknown[] },
  loginCustomerId?: string,
): Promise<{ results?: { resourceName?: string }[]; error?: { message?: string } }> {
  assertDeveloperToken(devToken);
  const clean = customerId.replace(/\D/g, "");
  const res = await fetch(
    `${API_BASE}/customers/${clean}/${servicePath.replace(/^\//, "")}:mutate`,
    {
      method: "POST",
      headers: headersForGoogleAds(accessToken, devToken, loginCustomerId),
      body: JSON.stringify(body),
    },
  );
  const j = (await res.json().catch(() => ({}))) as {
    results?: { resourceName?: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    return { error: { message: j.error?.message ?? `mutate ${servicePath} (${res.status})` } };
  }
  if (j.error) {
    return { error: j.error };
  }
  return { results: j.results };
}
