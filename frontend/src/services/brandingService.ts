import { getApiBaseUrl } from "@/lib/apiOrigin";

export type PublicBrandingMeta = {
  has_favicon: boolean;
  updated_at?: string;
};

export const brandingService = {
  /** Nunca lança: rede/CORS/502 não devem bloquear a app nem a página de login. */
  async getPublicMeta(): Promise<PublicBrandingMeta> {
    try {
      const r = await fetch(`${getApiBaseUrl()}/public/branding`);
      if (!r.ok) {
        return { has_favicon: false };
      }
      return r.json();
    } catch {
      return { has_favicon: false };
    }
  },

  faviconHref(updatedAt?: string): string {
    const q = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
    return `${getApiBaseUrl()}/public/branding/favicon${q}`;
  },
};
