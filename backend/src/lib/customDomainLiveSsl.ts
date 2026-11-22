import {
  isVercelConfigured,
  probeHostnameHttps,
  vercelGetProjectDomain,
  vercelVerifyProjectDomain,
} from "./vercelProjectDomains";
import type { CustomDomainSslLive } from "./customDomainSslState";

export type CustomDomainLiveSslInput = {
  status: string;
  hostname: string;
  vercelDomainRegistered: boolean;
};

/**
 * Probe go-live: HTTPS no edge + estado Vercel.
 * O HTTPS é sempre testado (mesmo sem VERCEL_TOKEN) para não ficar eternamente
 * em «A activar segurança» quando o domínio já aponta para 76.76.21.21.
 */
export async function probeCustomDomainLiveSsl(
  row: CustomDomainLiveSslInput,
): Promise<CustomDomainSslLive | null> {
  if (row.status !== "verified") return null;

  let httpsReachable = await probeHostnameHttps(row.hostname);

  if (!row.vercelDomainRegistered || !isVercelConfigured()) {
    return { httpsReachable, vercelVerified: null, vercelMisconfigured: null };
  }

  let v = await vercelGetProjectDomain(row.hostname);

  if (!httpsReachable) {
    await vercelVerifyProjectDomain(row.hostname);
    v = await vercelGetProjectDomain(row.hostname);
    httpsReachable = await probeHostnameHttps(row.hostname);
  }

  if (!v.ok) {
    return { httpsReachable, vercelVerified: null, vercelMisconfigured: null };
  }

  return {
    vercelVerified: v.verified,
    vercelMisconfigured: v.misconfigured,
    httpsReachable,
  };
}