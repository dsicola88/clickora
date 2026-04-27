/** Persiste o workspace (tenant) escolhido no browser para o redirect em `/app`. */
export const ACTIVE_ORGANIZATION_ID_KEY = "dpiloto.activeOrganizationId";

export function getActiveOrganizationIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ORGANIZATION_ID_KEY);
}

export function setActiveOrganizationIdInStorage(organizationId: string | null): void {
  if (typeof window === "undefined") return;
  if (organizationId) {
    window.localStorage.setItem(ACTIVE_ORGANIZATION_ID_KEY, organizationId);
  } else {
    window.localStorage.removeItem(ACTIVE_ORGANIZATION_ID_KEY);
  }
}
