import { getApiBaseUrl } from "@/lib/apiOrigin";
import { EMPTY_SUPPORT_CONTACTS, type PublicSupportContacts } from "@/lib/siteLegal";

export type PublicBrandingMeta = PublicSupportContacts & {
  has_favicon: boolean;
  updated_at?: string;
};

function normalizeMeta(raw: Partial<PublicBrandingMeta> | null | undefined): PublicBrandingMeta {
  const email = typeof raw?.support_email === "string" && raw.support_email.trim() ? raw.support_email.trim() : null;
  const phone = typeof raw?.support_phone === "string" && raw.support_phone.trim() ? raw.support_phone.trim() : null;
  const display =
    typeof raw?.support_phone_display === "string" && raw.support_phone_display.trim()
      ? raw.support_phone_display.trim()
      : null;
  const wa =
    typeof raw?.support_whatsapp_url === "string" && raw.support_whatsapp_url.trim()
      ? raw.support_whatsapp_url.trim()
      : null;
  return {
    has_favicon: Boolean(raw?.has_favicon),
    updated_at: raw?.updated_at,
    support_email: email,
    support_phone: phone,
    support_phone_display: display,
    support_whatsapp_url: wa,
    configured: Boolean(email || phone || raw?.configured),
  };
}

export const brandingService = {
  /** Nunca lança: rede/CORS/502 não devem bloquear a app nem a página de login. */
  async getPublicMeta(): Promise<PublicBrandingMeta> {
    try {
      const r = await fetch(`${getApiBaseUrl()}/public/branding`);
      if (!r.ok) {
        return { has_favicon: false, ...EMPTY_SUPPORT_CONTACTS };
      }
      return normalizeMeta(await r.json());
    } catch {
      return { has_favicon: false, ...EMPTY_SUPPORT_CONTACTS };
    }
  },

  faviconHref(updatedAt?: string): string {
    const q = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
    return `${getApiBaseUrl()}/public/branding/favicon${q}`;
  },
};
