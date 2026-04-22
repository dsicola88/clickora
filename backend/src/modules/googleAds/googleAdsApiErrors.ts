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

  const detail = t.length > MAX_API_ERROR_LEN ? `${t.slice(0, MAX_API_ERROR_LEN)}…` : t;
  return `Não foi possível obter dados da Google Ads. Detalhe técnico: ${detail}`;
}
