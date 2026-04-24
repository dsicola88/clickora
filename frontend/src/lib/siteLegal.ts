/** Contacto público (privacidade, suporte). Configure `VITE_PUBLIC_SUPPORT_EMAIL` no build do site. */
export const SITE_SUPPORT_EMAIL =
  import.meta.env.VITE_PUBLIC_SUPPORT_EMAIL?.trim() || "suporte@dclickora.com";

export const SITE_LEGAL_NAME =
  import.meta.env.VITE_PUBLIC_LEGAL_ENTITY_NAME?.trim() || "Clickora / dclickora";
