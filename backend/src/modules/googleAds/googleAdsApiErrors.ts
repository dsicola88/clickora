/**
 * Mensagens de utilizador final para falhas Google Ads API (relatórios / GAQL).
 * Tom institucional, em português europeu.
 *
 * Nota: mensagens de «setup» estão separadas entre plataforma (admin) e conta do utilizador.
 */

/** Variáveis GOOGLE_ADS_* em falta no servidor — não pedir ao utilizador final que «configure a API». */
export const GOOGLE_ADS_REPORTING_PLATFORM_NOT_READY =
  "Os relatórios Google Ads ainda não estão ativos neste ambiente. Se a sua subscrição incluir esta funcionalidade, contacte o suporte ou o administrador da plataforma.";

/** Utilizador ainda não autorizou a app junto da Google. */
export const GOOGLE_ADS_REPORTING_USER_OAUTH_REQUIRED =
  "Para ver estes relatórios, ligue primeiro a sua conta Google em «Resumo e guia» → Google Ads (utilize «Ligar com Google»).";

/** Customer ID em falta no perfil do utilizador. */
export const GOOGLE_ADS_REPORTING_USER_CUSTOMER_ID_REQUIRED =
  "Para ver estes relatórios, indique o Customer ID da sua conta Google Ads em «Resumo e guia» → Google Ads.";

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
    return "A Google Ads API não indicou o motivo do erro. Tente novamente dentro de alguns minutos.";
  }

  if (lower.includes("invalid_grant") || lower.includes("unauthenticated") || /\b401\b/.test(lower)) {
    return "A autorização Google expirou ou foi revogada. Volte a ligar a conta em «Resumo e guia» → Google Ads.";
  }
  if (
    lower.includes("permission_denied") ||
    lower.includes("user doesn't have permission") ||
    (lower.includes("403") && lower.includes("permission"))
  ) {
    return "Não tem permissão para consultar esta conta Google Ads. Confirme o acesso do utilizador, o gestor de contas (MCC / login customer) e o nível do developer token.";
  }
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate exceeded") ||
    lower.includes("too many requests")
  ) {
    return "O limite de pedidos à Google Ads foi atingido. Aguarde alguns minutos e tente novamente.";
  }
  if (lower.includes("deadline_exceeded") || lower.includes("timeout") || lower.includes("etimedout")) {
    return "O pedido à Google Ads excedeu o tempo limite. Tente novamente.";
  }
  if (lower.includes("invalid_customer") || lower.includes("customer not found")) {
    return "O Customer ID não foi encontrado ou não está acessível com estas credenciais. Verifique o ID em «Resumo e guia».";
  }
  if (lower.includes("developer_token") && (lower.includes("not approved") || lower.includes("provisional"))) {
    return "O developer token ainda não tem o nível de acesso necessário. Consulte o estado do token na Google Ads API Center.";
  }

  /** Resposta Axios/gRPC tratada de forma incorrecta por versões da biblioteca — não é o erro real da Google. */
  if (
    lower.includes("cannot read properties of undefined") &&
    (lower.includes("reading 'get'") || lower.includes('reading "get"'))
  ) {
    return (
      "A ligação à Google Ads falhou (resposta inesperada). Confirme a internet, volte a autorizar em «Resumo e guia» → Google Ads, " +
      "verifique o Customer ID e tente de novo em alguns minutos. Se persistir, o servidor pode estar a receber um erro da Google que não foi interpretado — contacte o suporte com a hora do pedido."
    );
  }

  if (!t || t === "[object object]" || /[\[\]{}]/.test(t)) {
    return "Não foi possível obter o custo do Google Ads neste período. Volte a ligar a conta em Integrações → Google Ads e confirme o ID da conta.";
  }

  const detail = t.length > MAX_API_ERROR_LEN ? `${t.slice(0, MAX_API_ERROR_LEN)}…` : t;
  return `Não foi possível obter o custo do Google Ads neste período. ${detail}`;
}
