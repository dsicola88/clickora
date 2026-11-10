/** Contacto público (privacidade, suporte). Override via env no build do site. */

export const SITE_SUPPORT_EMAIL =
  import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL?.trim() || "dclickoraoficial@gmail.com";

/** Telefone / WhatsApp (formato internacional, só dígitos com indicativo). */
export const SITE_SUPPORT_PHONE_E164 =
  import.meta.env.VITE_PUBLIC_SUPPORT_PHONE?.trim().replace(/[^\d+]/g, "") || "+244926510294";

/** Número só com dígitos (para wa.me). */
export const SITE_SUPPORT_PHONE_DIGITS = SITE_SUPPORT_PHONE_E164.replace(/\D/g, "");

/** Exibição amigável: +244 926 510 294 */
export function formatSupportPhoneDisplay(e164: string = SITE_SUPPORT_PHONE_E164): string {
  const d = e164.replace(/\D/g, "");
  if (d.startsWith("244") && d.length >= 12) {
    return `+244 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9, 12)}`;
  }
  return e164.startsWith("+") ? e164 : `+${d}`;
}

export const SITE_SUPPORT_PHONE_DISPLAY = formatSupportPhoneDisplay();

export const SITE_SUPPORT_MAILTO = `mailto:${SITE_SUPPORT_EMAIL}`;

export const SITE_SUPPORT_TEL = `tel:${SITE_SUPPORT_PHONE_E164}`;

export const SITE_SUPPORT_WHATSAPP = `https://wa.me/${SITE_SUPPORT_PHONE_DIGITS}`;

export const SITE_LEGAL_NAME =
  import.meta.env.VITE_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "Clickora / dclickora";
