import { systemPrisma } from "./prisma";
import { isVercelConfigured, probeHostnameHttps, vercelGetProjectDomain } from "./vercelProjectDomains";
import { resolveCustomDomainSslState } from "./customDomainSslState";

export type DomainGoLiveSummary = {
  verified_hosting: number;
  https_ready_hosting: number;
  ssl_provisioning: number;
  misconfigured: number;
  /** Pronto para Final URL em ads: HTTPS ready OU DNS verificado sem Vercel. */
  ad_ready_hosting: number;
};

/**
 * Resumo go-live dos domínios hosting da conta (probe live, máx. 3 Vercel).
 * Usado em account_health e onboarding — não na listagem rápida.
 */
export async function summarizeUserDomainGoLive(userId: string): Promise<DomainGoLiveSummary> {
  const rows = await systemPrisma.customDomain.findMany({
    where: { userId, purpose: { not: "tracking" } },
    select: {
      hostname: true,
      status: true,
      vercelDomainRegistered: true,
      purpose: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let verified_hosting = 0;
  let https_ready_hosting = 0;
  let ssl_provisioning = 0;
  let misconfigured = 0;
  let ad_ready_hosting = 0;

  const vercelVerified = rows.filter((r) => r.status === "verified" && r.vercelDomainRegistered);
  const toProbe = isVercelConfigured() ? vercelVerified.slice(0, 3) : [];

  const liveByHost = new Map<
    string,
    { vercelVerified: boolean | null; vercelMisconfigured: boolean | null; httpsReachable: boolean }
  >();

  await Promise.all(
    toProbe.map(async (r) => {
      const [v, httpsReachable] = await Promise.all([
        vercelGetProjectDomain(r.hostname),
        probeHostnameHttps(r.hostname),
      ]);
      liveByHost.set(r.hostname, {
        vercelVerified: v.ok ? v.verified : null,
        vercelMisconfigured: v.ok ? v.misconfigured : null,
        httpsReachable,
      });
    }),
  );

  for (const r of rows) {
    if (r.status !== "verified") continue;
    verified_hosting += 1;
    const live = liveByHost.get(r.hostname) ?? null;
    const ssl = resolveCustomDomainSslState({
      status: r.status,
      vercelDomainRegistered: r.vercelDomainRegistered,
      live: live
        ? {
            vercelVerified: live.vercelVerified,
            vercelMisconfigured: live.vercelMisconfigured,
            httpsReachable: live.httpsReachable,
          }
        : null,
    });
    if (ssl.ssl_state === "https_ready") https_ready_hosting += 1;
    if (ssl.ssl_state === "ssl_provisioning") ssl_provisioning += 1;
    if (ssl.ssl_state === "misconfigured") misconfigured += 1;
    if (ssl.https_ready || (!r.vercelDomainRegistered && r.status === "verified")) {
      ad_ready_hosting += 1;
    }
  }

  return {
    verified_hosting,
    https_ready_hosting,
    ssl_provisioning,
    misconfigured,
    ad_ready_hosting,
  };
}
