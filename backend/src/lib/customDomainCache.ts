import { systemPrisma } from "./prisma";

/** Origins `https://hostname` com domínio personalizado verificado — CORS. */
const verifiedOrigins = new Set<string>();
/** hostname -> userId */
const hostnameToUserId = new Map<string, string>();

export async function refreshCustomDomainCache(): Promise<void> {
  const rows = await systemPrisma.customDomain.findMany({
    where: { status: "verified" },
    select: { hostname: true, userId: true },
  });
  verifiedOrigins.clear();
  hostnameToUserId.clear();
  for (const r of rows) {
    const h = r.hostname.toLowerCase();
    hostnameToUserId.set(h, r.userId);
    try {
      verifiedOrigins.add(new URL(`https://${h}`).origin);
    } catch {
      // ignore bad hostname rows
    }
  }
}

export function isVerifiedCustomDomainOrigin(origin: string): boolean {
  return verifiedOrigins.has(origin.trim());
}

/** Se o Host for um domínio personalizado verificado, devolve o userId dono; caso contrário `null`. */
export function getVerifiedOwnerIdForHostname(hostname: string | null | undefined): string | null {
  if (!hostname) return null;
  return hostnameToUserId.get(hostname.toLowerCase()) ?? null;
}
