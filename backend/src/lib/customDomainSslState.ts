/**
 * Estado go-live / SSL do domínio personalizado (separado de DNS «verified»).
 *
 * - pending_dns: ainda a validar propriedade
 * - dns_verified: TXT/legado verificado, sem Vercel (sem SSL gerido)
 * - ssl_provisioning: DNS Vercel OK / a emitir certificado
 * - https_ready: HTTPS responde no hostname
 * - misconfigured: Vercel reporta DNS mal apontado
 * - unknown: sem dados suficientes
 */
export type CustomDomainSslState =
  | "pending_dns"
  | "dns_verified"
  | "ssl_provisioning"
  | "https_ready"
  | "misconfigured"
  | "unknown";

export type CustomDomainSslLive = {
  /** Vercel project domain.verified */
  vercelVerified?: boolean | null;
  /** Vercel project domain.misconfigured */
  vercelMisconfigured?: boolean | null;
  /** HEAD/GET https://hostname/ devolveu 2xx–499 (edge alcançável). */
  httpsReachable?: boolean | null;
};

export function resolveCustomDomainSslState(args: {
  status: string;
  vercelDomainRegistered: boolean;
  live?: CustomDomainSslLive | null;
}): { ssl_state: CustomDomainSslState; https_ready: boolean } {
  const status = String(args.status || "").toLowerCase();
  if (status === "pending") {
    return { ssl_state: "pending_dns", https_ready: false };
  }
  if (status !== "verified") {
    return { ssl_state: "unknown", https_ready: false };
  }
  if (!args.vercelDomainRegistered) {
    return { ssl_state: "dns_verified", https_ready: false };
  }

  const live = args.live ?? null;
  if (live?.vercelMisconfigured === true) {
    return { ssl_state: "misconfigured", https_ready: false };
  }
  if (live?.httpsReachable === true) {
    return { ssl_state: "https_ready", https_ready: true };
  }
  if (live?.vercelVerified === false) {
    return { ssl_state: "ssl_provisioning", https_ready: false };
  }
  // Verificado na app + Vercel registado; sem probe ainda → a provisionar SSL/edge
  return { ssl_state: "ssl_provisioning", https_ready: false };
}

export function sslStateLabelPt(state: CustomDomainSslState): string {
  switch (state) {
    case "pending_dns":
      return "DNS pendente";
    case "dns_verified":
      return "DNS verificado";
    case "ssl_provisioning":
      return "SSL a provisionar";
    case "https_ready":
      return "HTTPS pronto";
    case "misconfigured":
      return "DNS mal configurado";
    default:
      return "Estado desconhecido";
  }
}
