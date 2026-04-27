import type { User } from "@/types/api";

/** Plano com `dpilot_ads_enabled` (ou `super_admin`) — página /tracking/dpilot (anúncios). */
export function userCanAccessDpilotAds(user: User | null | undefined, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return Boolean(user?.plan?.dpilot_ads_enabled);
}
