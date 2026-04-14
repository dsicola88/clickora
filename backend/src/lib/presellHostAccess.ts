import type { Request } from "express";
import { getRequestHostname } from "./requestHost";
import { getVerifiedOwnerIdForHostname } from "./customDomainCache";

/**
 * Em `dclickora.com` não restringe. Num hostname com domínio personalizado verificado,
 * só presells/tracking do dono desse hostname.
 */
export function assertPresellAllowedOnRequestHost(req: Request, pageUserId: string): boolean {
  const host = getRequestHostname(req);
  const ownerId = getVerifiedOwnerIdForHostname(host);
  if (!ownerId) return true;
  return ownerId === pageUserId;
}
