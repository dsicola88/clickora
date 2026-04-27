/** Slug da landing pública a mostrar em `/` (página de vendas). */
export const DEFAULT_HOME_LANDING_SLUG = "vendas";

export function getHomeLandingSlug(): string {
  const raw = import.meta.env.VITE_HOME_LANDING_SLUG;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const s = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (s.length >= 2) {
      return s;
    }
  }
  return DEFAULT_HOME_LANDING_SLUG;
}
