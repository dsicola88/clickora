/**
 * Rodapé «POLICIES» / identidade do afiliado na página pública.
 * Só com `showAffiliateTrustFooter: true` explícito. Ausente/false = página limpa.
 */
export function isAffiliateTrustFooterEnabled(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  if (!settings || !Object.prototype.hasOwnProperty.call(settings, "showAffiliateTrustFooter")) {
    return false;
  }
  const v = settings.showAffiliateTrustFooter;
  if (v === false || v === 0 || v === "false" || v === "0") return false;
  return Boolean(v);
}

/** Em create: grava false se a chave não vier no payload (nunca herdar “ligado” por omissão). */
export function ensureShowAffiliateTrustFooterOnCreate(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.prototype.hasOwnProperty.call(settings, "showAffiliateTrustFooter")) {
    return settings;
  }
  return { ...settings, showAffiliateTrustFooter: false };
}
