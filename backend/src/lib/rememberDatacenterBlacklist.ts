/**
 * Auto-blacklist só com evidência explícita (CDN77 / AWS / GCP oficiais).
 * Nunca para crawlers Google. O utilizador pode sempre adicionar IPs à mão.
 */
import { systemPrisma } from "./prisma";
import { normalizeIpForMatch } from "./normalizeIp";
import { isPrivateOrLocalIp } from "./clientIp";
import { isProtectedGoogleCrawlerUserAgent } from "./detectBot";

export async function rememberDatacenterBlacklist(args: {
  userId: string;
  ip: string | null | undefined;
  network?: string | null;
  /** Se false, só marca no relatório — não grava blacklist. */
  eligible?: boolean;
  userAgent?: string | null;
}): Promise<{ blacklisted: boolean; reason: string }> {
  if (args.eligible === false) {
    return { blacklisted: false, reason: "not_eligible" };
  }
  if (isProtectedGoogleCrawlerUserAgent(args.userAgent)) {
    return { blacklisted: false, reason: "protected_google_crawler" };
  }
  const ipKey = normalizeIpForMatch(args.ip || "");
  if (!ipKey || isPrivateOrLocalIp(ipKey)) {
    return { blacklisted: false, reason: "invalid_ip" };
  }
  const net = (args.network || "").trim();
  if (!net || !/^(CDN77|AWS|GCP)$/i.test(net)) {
    return { blacklisted: false, reason: "network_not_explicit" };
  }
  const reason = `Datacenter explícito (${net}) — lista AWS/GCP/CDN77`;
  try {
    await systemPrisma.blacklistedIp.upsert({
      where: { userId_ipAddress: { userId: args.userId, ipAddress: ipKey } },
      create: {
        userId: args.userId,
        ipAddress: ipKey,
        reason,
      },
      update: { reason },
    });
    return { blacklisted: true, reason: "ok" };
  } catch (e) {
    console.warn("[rememberDatacenterBlacklist]", e instanceof Error ? e.message : e);
    return { blacklisted: false, reason: "db_error" };
  }
}
