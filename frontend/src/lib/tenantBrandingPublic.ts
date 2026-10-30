import type { Presell } from "@/types/api";

/** Shape espelhado de `mapPresellForPublic` → `tenant_branding`. */
export type PublicTenantBranding = {
  brand_name?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeTenantHex(raw: string | null | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!HEX.test(t)) return null;
  if (t.length === 4) {
    const r = t[1]!;
    const g = t[2]!;
    const b = t[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return t.toUpperCase();
}

export function readPublicTenantBranding(page: Pick<Presell, "tenant_branding">): PublicTenantBranding | null {
  const b = page.tenant_branding;
  if (!b || typeof b !== "object") return null;
  const brand_name = typeof b.brand_name === "string" ? b.brand_name.trim() || null : null;
  const logo_url = typeof b.logo_url === "string" ? b.logo_url.trim() || null : null;
  const favicon_url = typeof b.favicon_url === "string" ? b.favicon_url.trim() || null : null;
  const primary_color = normalizeTenantHex(b.primary_color);
  const accent_color = normalizeTenantHex(b.accent_color);
  if (!brand_name && !logo_url && !favicon_url && !primary_color && !accent_color) return null;
  return { brand_name, logo_url, favicon_url, primary_color, accent_color };
}

/** Crédito «powered by dclickora» — só quando a API pública marca `footer_branding: true`. */
export function shouldShowPlatformFooterBranding(page: Pick<Presell, "footer_branding">): boolean {
  return page.footer_branding === true;
}

/** Variáveis CSS aplicadas ao root da lander pública. */
export function tenantBrandingCssVars(
  branding: PublicTenantBranding | null,
): Record<string, string> | undefined {
  if (!branding) return undefined;
  const out: Record<string, string> = {};
  if (branding.primary_color) {
    out["--tenant-primary"] = branding.primary_color;
    out["--tenant-primary-fg"] = "#FFFFFF";
  }
  if (branding.accent_color) {
    out["--tenant-accent"] = branding.accent_color;
  }
  return Object.keys(out).length ? out : undefined;
}

export function resolveTenantFaviconUrl(branding: PublicTenantBranding | null): string | undefined {
  const u = branding?.favicon_url?.trim() || branding?.logo_url?.trim();
  return u || undefined;
}

export function resolveTenantSiteName(branding: PublicTenantBranding | null): string | undefined {
  const n = branding?.brand_name?.trim();
  return n || undefined;
}
