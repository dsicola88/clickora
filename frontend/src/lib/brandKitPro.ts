/**
 * Brand kit Pro partilhado (Agency / wizard / exports).
 * Sync remoto fica em BrandKitProCard; este módulo só lê o rascunho local.
 */

export type BrandKitPro = {
  brandName: string;
  primaryColor: string;
  supportEmail: string;
  logoUrl: string;
};

export const BRAND_KIT_STORAGE_KEY = "dclickora.brandKitPro";

export const BRAND_KIT_DEFAULTS: BrandKitPro = {
  brandName: "",
  primaryColor: "#0f766e",
  supportEmail: "",
  logoUrl: "",
};

export function readBrandKitPro(): BrandKitPro {
  try {
    const raw = localStorage.getItem(BRAND_KIT_STORAGE_KEY);
    if (!raw) return { ...BRAND_KIT_DEFAULTS };
    return { ...BRAND_KIT_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...BRAND_KIT_DEFAULTS };
  }
}

export function writeBrandKitPro(kit: BrandKitPro): void {
  localStorage.setItem(BRAND_KIT_STORAGE_KEY, JSON.stringify(kit));
}
