/**
 * Google Ads API (REST) — versões sunset devolvem 404 HTML (ex. v16, depois v21).
 * Em nov/2026 as versões ativas começam em v23; latest = v26.
 * @see https://developers.google.com/google-ads/api/docs/sunset-dates
 */
const ADS_VERSION = "v26";
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

/** OAuth do projecto Cloud basta; developer token é opcional desde o sunset (set/2026). */
export function isGoogleAdsOAuthConfigured(): boolean {
  return Boolean(getClientId() && getClientSecret());
}

/** Header legado — a API ignora o valor; vazio se não houver env. */
export function resolveDeveloperTokenHeader(): string {
  return getGoogleDeveloperToken() ?? "";
}

/** Token opcional pós-sunset; garante string ("" se em falta). */
function assertDeveloperToken(t: string | undefined): asserts t is string {
  if (typeof t !== "string") {
    throw new Error("developer-token header inválido.");
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

/**
 * @deprecated Não usar para ligar contas Paid/Integrações — escolhe `resourceNames[0]`
 * e pode apontar para outra conta. Preferir customer ID explícito + fetchCustomerMeta.
 */
export async function listFirstAccessibleCustomerId(
  accessToken: string,
): Promise<{ customerId: string; name: string | null }> {
  const dev = resolveDeveloperTokenHeader();
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
  const meta = await fetchCustomerMeta(accessToken, customerId, loginCustomerId);
  return meta?.name ?? null;
}

const CUSTOMER_META_QUERY =
  "SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1";

function parseCustomerMetaRow(
  results: unknown[] | undefined,
  fallbackId: string,
): { id: string; name: string | null; manager: boolean } | null {
  if (!Array.isArray(results) || results.length === 0) return null;
  const row = results[0] as {
    customer?: { id?: string | number; descriptiveName?: string; manager?: boolean };
  };
  const c = row.customer;
  if (!c) return null;
  return {
    id: String(c.id ?? fallbackId).replace(/\D/g, ""),
    name: c.descriptiveName ? String(c.descriptiveName) : null,
    manager: c.manager === true,
  };
}

/** Metadados mínimos da conta (nome + se é MCC). */
export async function fetchCustomerMeta(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<{ id: string; name: string | null; manager: boolean } | null> {
  const dev = resolveDeveloperTokenHeader();
  assertDeveloperToken(dev);
  const clean = customerId.replace(/\D/g, "");
  const s = await runGoogleAdsSearch(accessToken, clean, dev, CUSTOMER_META_QUERY, loginCustomerId);
  if (s.error) return null;
  return parseCustomerMetaRow(s.results, clean);
}

export type ResolvedGoogleAdsCustomer =
  | {
      ok: true;
      meta: { id: string; name: string | null; manager: boolean };
      /** undefined = conta solo / directa (sem header login-customer-id). */
      loginCustomerId: string | undefined;
      access_mode: "solo" | "mcc";
    }
  | { ok: false; error: string };

async function listAccessibleCustomerIds(accessToken: string, devToken: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
    method: "GET",
    headers: headersForGoogleAds(accessToken, devToken),
  });
  const j = (await res.json().catch(() => ({}))) as { resourceNames?: string[] };
  if (!res.ok) return [];
  return (j.resourceNames ?? [])
    .map((r) => {
      const m = /^customers\/(\d+)$/.exec(r);
      return m ? m[1]! : r.replace(/\D/g, "");
    })
    .filter(Boolean);
}

/**
 * Lê a conta cliente em modo solo OU via MCC.
 * Ordem: sem MCC → MCC guardado → cada gestor acessível como login-customer-id.
 * Persistir o `loginCustomerId` devolvido (null/undefined = solo).
 */
export async function resolveReadableGoogleAdsCustomer(
  accessToken: string,
  customerId: string,
  hintLoginCustomerId?: string | null,
): Promise<ResolvedGoogleAdsCustomer> {
  const dev = resolveDeveloperTokenHeader();
  assertDeveloperToken(dev);
  const clean = customerId.replace(/\D/g, "");
  if (!clean) {
    return { ok: false, error: "Customer ID em falta." };
  }

  const hint = normalizeLoginCustomerId(clean, hintLoginCustomerId);
  const tried = new Set<string>();
  const errors: string[] = [];

  const tryLogin = async (
    login: string | undefined,
    mode: "solo" | "mcc",
  ): Promise<ResolvedGoogleAdsCustomer | null> => {
    const key = login ?? "__solo__";
    if (tried.has(key)) return null;
    tried.add(key);
    const s = await runGoogleAdsSearch(accessToken, clean, dev, CUSTOMER_META_QUERY, login);
    if (s.error) {
      errors.push(s.error.message ?? "erro");
      return null;
    }
    const meta = parseCustomerMetaRow(s.results, clean);
    if (!meta) {
      errors.push(login ? `MCC ${login}: resposta vazia` : "solo: resposta vazia");
      return null;
    }
    return { ok: true, meta, loginCustomerId: login, access_mode: mode };
  };

  /** 1) Conta particular / solo — sem login-customer-id. */
  const solo = await tryLogin(undefined, "solo");
  if (solo?.ok) return solo;

  /** 2) MCC explícito em Integrações (se diferente da conta). */
  if (hint) {
    const withHint = await tryLogin(hint, "mcc");
    if (withHint?.ok) return withHint;
  }

  /** 3) Descobrir MCC: gestores acessíveis com o mesmo OAuth. */
  const accessible = await listAccessibleCustomerIds(accessToken, dev);
  const candidates: string[] = [];
  for (const id of accessible) {
    if (id === clean) continue;
    let probe = await runGoogleAdsSearch(accessToken, id, dev, CUSTOMER_META_QUERY, undefined, {
      skipSoloRetry: true,
    });
    if (probe.error) {
      /** Gestor muitas vezes só responde com login = próprio id. */
      probe = await runGoogleAdsSearch(accessToken, id, dev, CUSTOMER_META_QUERY, id, {
        allowSameLoginAsCustomer: true,
        skipSoloRetry: true,
      });
    }
    if (probe.error) continue;
    const m = parseCustomerMetaRow(probe.results, id);
    if (m?.manager) candidates.push(id);
  }

  for (const mcc of candidates) {
    const viaMcc = await tryLogin(mcc, "mcc");
    if (viaMcc?.ok) return viaMcc;
  }

  const detail = errors.slice(0, 3).join(" · ") || "sem detalhe da API";
  return {
    ok: false,
    error: `Não foi possível ler a conta ${clean} (solo nem via MCC). ${detail}`,
  };
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
  const dev = resolveDeveloperTokenHeader();
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
  const dev = resolveDeveloperTokenHeader();
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

/**
 * Normaliza MCC para contas cliente: vazio / igual ao customer → sem header (solo).
 * Para ler a própria MCC, use `allowSameAsCustomer` (login = customer id do gestor).
 */
export function normalizeLoginCustomerId(
  customerId: string,
  loginCustomerId?: string | null,
  opts?: { allowSameAsCustomer?: boolean },
): string | undefined {
  const customer = customerId.replace(/\D/g, "");
  const login = (loginCustomerId ?? "").replace(/\D/g, "");
  if (!login || !customer) return undefined;
  if (login === customer && !opts?.allowSameAsCustomer) return undefined;
  return login;
}

function headersForGoogleAds(
  accessToken: string,
  devToken: string,
  loginCustomerId?: string,
): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  /** Header vazio causa «invalid argument» em algumas contas — só envia se houver token. */
  const dev = (devToken ?? "").trim();
  if (dev) h["developer-token"] = dev;
  if (loginCustomerId) {
    h["login-customer-id"] = loginCustomerId.replace(/\D/g, "");
  }
  return h;
}

/** Alinhado com Funil (`managerLoginRequired`) — MCC errado ou conta solo com header. */
function looksLikeBadLoginCustomer(message: string | undefined): boolean {
  const t = (message ?? "").toLowerCase();
  return (
    t.includes("invalid argument") ||
    t.includes("login-customer-id") ||
    t.includes("login customer") ||
    t.includes("cannot be the same") ||
    t.includes("permission to access customer") ||
    t.includes("user doesn't have permission") ||
    t.includes("permission_denied")
  );
}

/** Extrai mensagens detalhadas de GoogleAdsFailure (REST). */
function extractGoogleAdsErrorMessage(j: unknown, fallback: string): string {
  const root = j as {
    error?: {
      message?: string;
      status?: string;
      details?: Array<{
        errors?: Array<{ message?: string; errorCode?: Record<string, string> }>;
        requestId?: string;
      }>;
    };
  };
  const base = root.error?.message ?? fallback;
  const parts: string[] = [];
  for (const d of root.error?.details ?? []) {
    for (const e of d.errors ?? []) {
      if (e.message) parts.push(e.message);
    }
    if (d.requestId) parts.push(`requestId=${d.requestId}`);
  }
  if (parts.length === 0) return base;
  return `${base} — ${parts.slice(0, 4).join("; ")}`;
}

function withCustomerContext(
  message: string,
  customerId: string,
  loginCustomerId?: string,
): string {
  const login = loginCustomerId ? ` MCC ${loginCustomerId}` : " sem MCC";
  return `Conta ${customerId}${login}: ${message}`;
}

/** Consulta genérica (GAQL). Se o MCC no header for errado, tenta de novo sem login-customer-id (conta solo). */
export async function runGoogleAdsSearch(
  accessToken: string,
  customerId: string,
  devToken: string,
  query: string,
  loginCustomerId?: string,
  opts?: { allowSameLoginAsCustomer?: boolean; skipSoloRetry?: boolean },
): Promise<{ results?: unknown[]; error?: { message?: string } }> {
  assertDeveloperToken(devToken);
  const clean = customerId.replace(/\D/g, "");
  const login = normalizeLoginCustomerId(clean, loginCustomerId, {
    allowSameAsCustomer: opts?.allowSameLoginAsCustomer,
  });

  const once = async (loginHeader?: string) => {
    const res = await fetch(`${API_BASE}/customers/${clean}/googleAds:search`, {
      method: "POST",
      headers: headersForGoogleAds(accessToken, devToken, loginHeader),
      body: JSON.stringify({ query, pageSize: 500 }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      results?: unknown[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        error: {
          message: withCustomerContext(
            extractGoogleAdsErrorMessage(j, `googleAds:search ${res.status}`),
            clean,
            loginHeader,
          ),
        },
      };
    }
    return { results: j.results };
  };

  const first = await once(login);
  if (!first.error) return first;
  /** MCC errado / conta solo: retry sem header. */
  if (!opts?.skipSoloRetry && login && looksLikeBadLoginCustomer(first.error.message)) {
    const retry = await once(undefined);
    if (!retry.error) return retry;
    return {
      error: {
        message: `${first.error.message} (também falhou sem MCC: ${retry.error?.message ?? "—"})`,
      },
    };
  }
  return first;
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
  const login = normalizeLoginCustomerId(clean, loginCustomerId);

  const once = async (loginHeader?: string) => {
    const res = await fetch(
      `${API_BASE}/customers/${clean}/${servicePath.replace(/^\//, "")}:mutate`,
      {
        method: "POST",
        headers: headersForGoogleAds(accessToken, devToken, loginHeader),
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
  };

  const first = await once(login);
  if (!first.error) return first;
  if (login && looksLikeBadLoginCustomer(first.error.message)) {
    const retry = await once(undefined);
    if (!retry.error) return retry;
    return first;
  }
  return first;
}

/**
 * Chamadas REST tipo `recommendations:apply` / `recommendations:dismiss` (não usam :mutate).
 */
export async function runGoogleAdsCustomerAction(
  accessToken: string,
  customerId: string,
  devToken: string,
  actionPath: string,
  body: unknown,
  loginCustomerId?: string,
): Promise<{ ok: true; raw: unknown } | { ok: false; error: string }> {
  assertDeveloperToken(devToken);
  const clean = customerId.replace(/\D/g, "");
  const login = normalizeLoginCustomerId(clean, loginCustomerId);
  const path = actionPath.replace(/^\//, "");

  const once = async (loginHeader?: string) => {
    const res = await fetch(`${API_BASE}/customers/${clean}/${path}`, {
      method: "POST",
      headers: headersForGoogleAds(accessToken, devToken, loginHeader),
      body: JSON.stringify(body ?? {}),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok || j.error) {
      return { ok: false as const, error: j.error?.message ?? `${path} (${res.status})` };
    }
    return { ok: true as const, raw: j as unknown };
  };

  const first = await once(login);
  if (first.ok) return first;
  if (login && looksLikeBadLoginCustomer(first.error)) {
    const retry = await once(undefined);
    if (retry.ok) return retry;
  }
  return first;
}
