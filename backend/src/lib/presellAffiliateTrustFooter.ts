/**
 * Rodapé «POLICIES» / identidade do afiliado na página pública.
 * Ausente = ligado (páginas antigas). `false` = página limpa, sem bloco de afiliado.
 */
export function isAffiliateTrustFooterEnabled(
  settings: Record<string, unknown> | null | undefined,
): boolean {
  if (!settings || !Object.prototype.hasOwnProperty.call(settings, "showAffiliateTrustFooter")) {
    return true;
  }
  const v = settings.showAffiliateTrustFooter;
  if (v === false || v === 0 || v === "false" || v === "0") return false;
  return Boolean(v);
}
