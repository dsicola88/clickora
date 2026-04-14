import type { Request } from "express";
import { getRequestHostname, hostnameLookupVariants } from "./requestHost";
import { getVerifiedOwnerIdForHostname } from "./customDomainCache";
import { systemPrisma } from "./prisma";

/**
 * Resolve o dono (userId) de um hostname com domínio personalizado verificado na BD.
 * Usado quando o cache em memória ainda não tem o mapeamento (arranque, race) ou está desatualizado.
 */
/** Hosts onde o URL público por slug não está disponível (usa-se só `/p/<uuid>`). */
export function isMainOrPreviewHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0];
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h.endsWith(".vercel.app")) return true;
  return h === "dclickora.com" || h === "www.dclickora.com";
}

export async function resolveVerifiedOwnerUserIdFromDb(hostname: string): Promise<string | null> {
  const variants = hostnameLookupVariants(hostname);
  if (variants.length === 0) return null;
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
  if (ownerId === pageUserId) return true;

  /** Confirma na BD (cache desatualizado ou hostname ligeiramente diferente do armazenado). */
  const owns = await systemPrisma.customDomain.findFirst({
    where: {
      status: "verified",
      userId: pageUserId,
      hostname: { in: hostnameLookupVariants(host) },
    },
    select: { id: true },
  });
  return !!owns;
}
