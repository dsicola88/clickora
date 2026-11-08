/**
 * Rodapé «POLICIES» / identidade do afiliado na página pública.
 * Páginas antigas sem a chave mantêm o rodapé (comportamento anterior).
 * Novas presells gravam `showAffiliateTrustFooter: false` por defeito (página limpa).
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
