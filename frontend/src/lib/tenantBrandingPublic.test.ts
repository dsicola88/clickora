import { describe, expect, it } from "vitest";
import type { Presell } from "@/types/api";
import {
  isPublicSafeTenantBrandName,
  normalizeTenantHex,
  readPublicTenantBranding,
  resolveTenantFaviconUrl,
  shouldShowPlatformFooterBranding,
  tenantBrandingCssVars,
} from "./tenantBrandingPublic";

function page(partial: Partial<Presell>): Presell {
  return {
    id: "p1",
    title: "t",
    content: {},
    slug: "s",
    type: "review",
    category: "x",
    language: "pt",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    settings: {},
    tracking: {},
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("tenantBrandingPublic", () => {
  it("normaliza hex curto e rejeita inválido", () => {
    expect(normalizeTenantHex("#0af")).toBe("#00AAFF");
    expect(normalizeTenantHex("#112233")).toBe("#112233");
    expect(normalizeTenantHex("red")).toBeNull();
  });

  it("lê tenant_branding da API pública", () => {
    const b = readPublicTenantBranding(
      page({
        tenant_branding: {
          brand_name: "Acme",
          logo_url: "https://cdn.example/logo.png",
          favicon_url: "https://cdn.example/f.ico",
          primary_color: "#0F172A",
          accent_color: "#abc",
        },
      }),
    );
    expect(b?.brand_name).toBe("Acme");
    expect(b?.primary_color).toBe("#0F172A");
    expect(b?.accent_color).toBe("#AABBCC");
    expect(resolveTenantFaviconUrl(b)).toBe("https://cdn.example/f.ico");
  });

  it("oculta nomes de papel interno (Super Admin) na lander", () => {
    expect(isPublicSafeTenantBrandName("Daniel Super Admin")).toBe(false);
    expect(isPublicSafeTenantBrandName("Visivra")).toBe(true);
    const b = readPublicTenantBranding(
      page({
        tenant_branding: {
          brand_name: "Daniel Super Admin",
          primary_color: "#0F766E",
        },
      }),
    );
    expect(b?.brand_name).toBeNull();
    expect(b?.primary_color).toBe("#0F766E");
  });

  it("footer só com footer_branding === true", () => {
    expect(shouldShowPlatformFooterBranding(page({ footer_branding: true }))).toBe(true);
    expect(shouldShowPlatformFooterBranding(page({ footer_branding: false }))).toBe(false);
    expect(shouldShowPlatformFooterBranding(page({}))).toBe(false);
  });

  it("css vars só com cores válidas", () => {
    expect(
      tenantBrandingCssVars({
        primary_color: "#112233",
        accent_color: "#445566",
      }),
    ).toEqual({
      "--tenant-primary": "#112233",
      "--tenant-primary-fg": "#FFFFFF",
      "--tenant-accent": "#445566",
    });
    expect(tenantBrandingCssVars(null)).toBeUndefined();
  });
});
