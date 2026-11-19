/**
 * Rodapé «POLICIES» / identidade do afiliado na página pública.
 * Só aparece com `showAffiliateTrustFooter: true` explícito.
 * Ausente ou false = página limpa (alinhado ao wizard e DEFAULT_PRESELL_CONFIG_SETTINGS).
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
