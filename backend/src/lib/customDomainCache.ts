import { normalizeHostname } from "./requestHost";
import { systemPrisma } from "./prisma";

/** Origins `https://hostname` com domínio personalizado verificado — CORS. */
const verifiedOrigins = new Set<string>();
/** hostname -> userId */
const hostnameToUserId = new Map<string, string>();

export async function refreshCustomDomainCache(): Promise<void> {
  try {
    const rows = await systemPrisma.customDomain.findMany({
      where: { status: "verified" },
      select: { hostname: true, userId: true },
    });
    verifiedOrigins.clear();
    hostnameToUserId.clear();
    for (const r of rows) {
      const h = normalizeHostname(r.hostname);
      if (!h) continue;
      hostnameToUserId.set(h, r.userId);
      if (h.startsWith("www.")) {
        hostnameToUserId.set(h.slice(4), r.userId);
      } else {
        hostnameToUserId.set(`www.${h}`, r.userId);
      }
      try {
        verifiedOrigins.add(new URL(`https://${h}`).origin);
        if (h.startsWith("www.")) {
          verifiedOrigins.add(new URL(`https://${h.slice(4)}`).origin);
        } else {
          verifiedOrigins.add(new URL(`https://www.${h}`).origin);
        }
      } catch {
        // ignore bad hostname rows
      }
    }
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
