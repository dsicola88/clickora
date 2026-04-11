import { getApiBaseUrl } from "@/lib/apiOrigin";

export type PublicBrandingMeta = {
  has_favicon: boolean;
  updated_at?: string;
};

export const brandingService = {
  async getPublicMeta(): Promise<PublicBrandingMeta> {
    const r = await fetch(`${getApiBaseUrl()}/public/branding`);
    if (!r.ok) {
      return { has_favicon: false };
    }
    return r.json();
  },

  faviconHref(updatedAt?: string): string {
    const q = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
    return `${getApiBaseUrl()}/public/branding/favicon${q}`;
  },
};
