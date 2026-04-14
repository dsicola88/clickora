import type { Request } from "express";
import { getRequestHostname } from "./requestHost";
import { getVerifiedOwnerIdForHostname } from "./customDomainCache";
import { systemPrisma } from "./prisma";

/**
 * Resolve o dono (userId) de um hostname com domínio personalizado verificado na BD.
 * Usado quando o cache em memória ainda não tem o mapeamento (arranque, race) ou está desatualizado.
 */
export async function resolveVerifiedOwnerUserIdFromDb(hostname: string): Promise<string | null> {
  const h = hostname.toLowerCase();
  const variants = [h];
  if (h.startsWith("www.")) variants.push(h.slice(4));
  else variants.push(`www.${h}`);
  const cd = await systemPrisma.customDomain.findFirst({
    where: { status: "verified", hostname: { in: variants } },
    select: { userId: true },
  });
  return cd?.userId ?? null;
}

/**
 * Em `dclickora.com` ou host sem domínio verificado não restringe.
 * Num hostname com domínio personalizado verificado, só presells/tracking do dono desse hostname.
 *
 * O cache em memória pode falhar no primeiro pedido; por isso há fallback à BD.
 */
export async function assertPresellAllowedOnRequestHost(req: Request, pageUserId: string): Promise<boolean> {
  const host = getRequestHostname(req);
  if (!host) return true;

  let ownerId = getVerifiedOwnerIdForHostname(host);
  if (!ownerId) {
    ownerId = await resolveVerifiedOwnerUserIdFromDb(host);
  }
  if (!ownerId) return true;
  return ownerId === pageUserId;
}
