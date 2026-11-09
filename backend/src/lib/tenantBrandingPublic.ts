/**
 * Filtro server-side para brand_name em landers públicas.
 * Espelha a regra do FE (`frontend/src/lib/tenantBrandingPublic.ts`).
 */
export function isPublicSafeTenantBrandName(name: string | null | undefined): boolean {
  const n = String(name ?? "").trim();
  if (!n) return false;
  if (n.length < 2) return false;
  if (
    /\b(super\s*admin|superadmin|administrador|admin(istrator)?|moderator|gerenciador|owner)\b/i.test(
      n,
    )
  ) {
    return false;
  }
  if (/^dclickora\b/i.test(n) || /^clickora\b/i.test(n)) return false;
  return true;
}
