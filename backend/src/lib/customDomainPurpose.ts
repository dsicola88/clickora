/** Domínios que podem alojar lander / ser `is_default` de hosting. */
export function isHostingCapablePurpose(purpose: string | null | undefined): boolean {
  return purpose !== "tracking";
}

/** Domínios elegíveis para pixel/redirect/embed de tracking. */
export function isTrackingCapablePurpose(purpose: string | null | undefined): boolean {
  return purpose === "tracking" || purpose === "both" || purpose == null;
}

export const hostingCapablePurposeFilter = {
  OR: [{ purpose: "hosting" as const }, { purpose: "both" as const }],
};

export const trackingCapablePurposeFilter = {
  OR: [{ purpose: "tracking" as const }, { purpose: "both" as const }],
};
