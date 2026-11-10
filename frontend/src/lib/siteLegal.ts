/**
 * Helpers de contacto / legais.
 * Os valores oficiais vêm da API pública (`/public/branding`) — configurados pelo superadmin.
 * Não há email/telefone inventados no frontend.
 */

export type PublicSupportContacts = {
  support_email: string | null;
  support_phone: string | null;
  support_phone_display: string | null;
  support_whatsapp_url: string | null;
  configured: boolean;
  updated_at?: string | null;
};

export const EMPTY_SUPPORT_CONTACTS: PublicSupportContacts = {
  support_email: null,
  support_phone: null,
  support_phone_display: null,
  support_whatsapp_url: null,
  configured: false,
  updated_at: null,
};

export function formatSupportPhoneDisplay(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("244") && d.length >= 12) {
    return `+244 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9, 12)}`;
  }
  return e164.startsWith("+") ? e164 : `+${d}`;
}

export function supportMailto(email: string | null | undefined): string | null {
  const e = email?.trim();
  return e ? `mailto:${e}` : null;
}

export function supportTel(phone: string | null | undefined): string | null {
  const p = phone?.trim();
  return p ? `tel:${p}` : null;
}

export function supportWhatsappUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  return d ? `https://wa.me/${d}` : null;
}

/** Nome legal da entidade — ainda via env (texto institucional). */
export const SITE_LEGAL_NAME =
  import.meta.env.VITE_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "Clickora / dclickora";

/**
 * @deprecated Preferir contactos da API. Mantido só para builds antigos / fallback vazio.
 * Nunca devolve um email inventado.
 */
export const SITE_SUPPORT_EMAIL =
  import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL?.trim() || "";
