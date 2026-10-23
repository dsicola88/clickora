/**
 * Após um clique/visita de IP cloud/datacenter, grava na blacklist da conta
 * para os próximos pedidos do mesmo IP não abrirem o hoplink (nem consumirem guard).
 * Não evita a 1.ª cobrança no Google Ads (o clique do anúncio já aconteceu).
 */
import { systemPrisma } from "./prisma";
import { normalizeIpForMatch } from "./normalizeIp";
import { isPrivateOrLocalIp } from "./clientIp";

export async function rememberDatacenterBlacklist(args: {
  userId: string;
  ip: string | null | undefined;
  network?: string | null;
}): Promise<void> {
  const ipKey = normalizeIpForMatch(args.ip || "");
  if (!ipKey || isPrivateOrLocalIp(ipKey)) return;
  const net = (args.network || "cloud").trim() || "cloud";
  const reason = `Datacenter/cloud automático (${net})`;
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
  } catch (e) {
    console.warn("[rememberDatacenterBlacklist]", e instanceof Error ? e.message : e);
  }
}
