/**
 * Mensagens de utilizador final para falhas Google Ads API (relatórios / GAQL).
 * Tom institucional, em português europeu.
 *
 * Nota: mensagens de «setup» estão separadas entre plataforma (admin) e conta do utilizador.
 */

/** Variáveis GOOGLE_ADS_* em falta no servidor — não pedir ao utilizador final que «configure a API». */
export const GOOGLE_ADS_REPORTING_PLATFORM_NOT_READY =
  "O custo do Google Ads ainda não está disponível. Se o seu plano incluir esta função, contacte o suporte.";

/** Utilizador ainda não autorizou a app junto da Google. */
export const GOOGLE_ADS_REPORTING_USER_OAUTH_REQUIRED =
  "Para ver o custo, ligue primeiro a conta Google em Integrações → Google Ads.";

/** Customer ID em falta no perfil do utilizador. */
export const GOOGLE_ADS_REPORTING_USER_CUSTOMER_ID_REQUIRED =
  "Para ver o custo, indique o número da conta Google Ads em Integrações → Google Ads.";

const MAX_API_ERROR_LEN = 480;

function readableErrorBits(value: unknown, depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || text === "[object Object]") return [];
    return [text];
  }
  if (typeof value === "number" || typeof value === "boolean") return [];
  if (Array.isArray(value)) return value.flatMap((item) => readableErrorBits(item, depth + 1));
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const bits: string[] = [];
  for (const key of ["message", "error", "errors", "failure", "details", "reason", "status"]) {
    if (key in record) bits.push(...readableErrorBits(record[key], depth + 1));
  }
  return bits;
}

/** Texto legível de um erro da biblioteca Google Ads, que por vezes traz a mensagem como objecto. */
export function plainGoogleAdsError(err: unknown): string {
  const unique = [...new Set(readableErrorBits(err))];
  return unique.slice(0, 3).join(" — ");
}

export function googleAdsErrorText(err: unknown): string {
  return humanizeGoogleAdsApiError(plainGoogleAdsError(err));
}

/** Transforma mensagens técnicas da biblioteca/API em texto compreensível para o utilizador. */
export function humanizeGoogleAdsApiError(raw: string): string {
  const t = raw.trim();
  const lower = t.toLowerCase();
  if (!t) {
    return "O Google não indicou o motivo. Tente de novo dentro de alguns minutos.";
  }

  if (lower.includes("invalid_grant") || lower.includes("unauthenticated") || /\b401\b/.test(lower)) {
    return "A autorização Google expirou. Volte a ligar a conta em Integrações → Google Ads.";
  }
  if (
    lower.includes("permission_denied") ||
    lower.includes("user doesn't have permission") ||
    (lower.includes("403") && lower.includes("permission"))
  ) {
    return "O Google não deixou ler esta conta. Confirme que a conta de anúncios é sua. Se usa uma conta que gere as outras, indique o número dela.";
  }
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate exceeded") ||
    lower.includes("too many requests")
  ) {
    return "O Google pediu uma pausa porque houve pedidos a mais. Aguarde alguns minutos e tente de novo.";
  }
  if (lower.includes("deadline_exceeded") || lower.includes("timeout") || lower.includes("etimedout")) {
    return "O Google demorou demasiado a responder. Tente de novo.";
  }
  if (lower.includes("invalid_customer") || lower.includes("customer not found")) {
    return "Não encontrámos esta conta de anúncios com a autorização que ligou. Confirme o número em Integrações → Google Ads.";
  }
  if (lower.includes("developer_token") && (lower.includes("not approved") || lower.includes("provisional"))) {
    return "A leitura de custos ainda não está disponível. Contacte o suporte.";
  }

  /** Resposta Axios/gRPC tratada de forma incorrecta por versões da biblioteca — não é o erro real da Google. */
  if (
    lower.includes("cannot read properties of undefined") &&
    (lower.includes("reading 'get'") || lower.includes('reading "get"'))
  ) {
    return (
      "A ligação ao Google Ads falhou. Volte a ligar a conta em Integrações → Google Ads e tente de novo dentro de alguns minutos. Se continuar, contacte o suporte."
    );
  }

  if (!t || t === "[object object]" || /[\[\]{}]/.test(t)) {
    return "Não foi possível obter o custo do Google Ads neste período. Volte a ligar a conta em Integrações → Google Ads e confirme o número da conta.";
  }

  const detail = t.length > MAX_API_ERROR_LEN ? `${t.slice(0, MAX_API_ERROR_LEN)}…` : t;
  return `Não foi possível obter o custo do Google Ads neste período. ${detail}`;
}
