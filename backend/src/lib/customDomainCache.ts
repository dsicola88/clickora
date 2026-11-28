import { normalizeHostname } from "./requestHost";
import { systemPrisma } from "./prisma";

/** Origins `https://hostname` com domínio personalizado verificado — CORS. */
const verifiedOrigins = new Set<string>();
/** hostname -> userId */
const hostnameToUserId = new Map<string, string>();

function wwwVariant(h: string): string {
  return h.startsWith("www.") ? h.slice(4) : `www.${h}`;
}

/**
 * Duas passagens: hostnames registados primeiro; a variante www/apex só entra se ninguém registou
 * esse host exato (um alias nunca sobrescreve o dono real).
 */
export function buildCustomDomainHostMaps(rows: Array<{ hostname: string; userId: string }>): {
  hostnameToUserId: Map<string, string>;
  origins: Set<string>;
} {
  const owners = new Map<string, string>();
  const hosts: string[] = [];
  for (const r of rows) {
    const h = normalizeHostname(r.hostname);
    if (!h) continue;
    owners.set(h, r.userId);
    hosts.push(h);
  }
  for (const h of hosts) {
    const alias = wwwVariant(h);
    if (!owners.has(alias)) owners.set(alias, owners.get(h)!);
  }
  const origins = new Set<string>();
  for (const h of owners.keys()) {
    try {
      origins.add(new URL(`https://${h}`).origin);
    } catch {
      // ignore bad hostname rows
    }
  }
  return { hostnameToUserId: owners, origins };
}

export async function refreshCustomDomainCache(): Promise<void> {
  try {
    const rows = await systemPrisma.customDomain.findMany({
      where: { status: "verified" },
      select: { hostname: true, userId: true },
    });
    const built = buildCustomDomainHostMaps(rows);
    verifiedOrigins.clear();
    hostnameToUserId.clear();
    for (const o of built.origins) verifiedOrigins.add(o);
    for (const [h, u] of built.hostnameToUserId) hostnameToUserId.set(h, u);
  } catch (e) {
    console.warn(
      "[customDomainCache] refresh omitido — base de dados indisponível (CORS de domínio próprio fica sem cache até próximo intervalo ou fix da ligação).",
      e instanceof Error ? e.message : e,
    );
  }
}

export function isVerifiedCustomDomainOrigin(origin: string): boolean {
  return verifiedOrigins.has(origin.trim());
}

/** Se o Host for um domínio personalizado verificado, devolve o userId dono; caso contrário `null`. */
export function getVerifiedOwnerIdForHostname(hostname: string | null | undefined): string | null {
  if (!hostname) return null;
  const key = normalizeHostname(hostname);
  if (!key) return null;
  return hostnameToUserId.get(key) ?? null;
}
