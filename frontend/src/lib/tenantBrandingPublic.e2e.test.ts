/**
 * Contrato FE: payload pública white-label → decisões da lander / export / SEO.
 * Complementa backend/scripts/e2e-tenant-branding-public.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Presell } from "@/types/api";
import {
  readPublicTenantBranding,
  shouldShowPlatformFooterBranding,
  tenantBrandingCssVars,
} from "@/lib/tenantBrandingPublic";
import { resolvePublicPresellFaviconUrl } from "@/lib/publicPresellSeo";
import { buildPresellStandaloneHtml } from "@/lib/presellExportHtml";

function basePage(partial: Partial<Presell>): Presell {
  return {
    id: "wl-1",
    title: "Campanha WL",
    slug: "wl-test",
    type: "review",
    category: "test",
    language: "pt",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    content: {
      title: "Produto",
      subtitle: "Sub",
      salesText: "Corpo da carta.",
      ctaText: "Comprar",
      affiliateLink: "https://example.com/offer",
      productImages: [],
    },
    settings: {},
    tracking: {},
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("white-label FE wiring (API → lander)", () => {
  it("PublicPresell liga tenant_branding + footer_branding", () => {
    const src = readFileSync(join(process.cwd(), "src/pages/PublicPresell.tsx"), "utf8");
    expect(src).toContain("readPublicTenantBranding");
    expect(src).toContain("shouldShowPlatformFooterBranding");
    expect(src).toContain("PresellTenantBrandChrome");
    expect(src).toContain("PresellPlatformCredit");
    expect(src).toContain("data-tenant-wl");
    expect(src).toContain("tenantBrandingCssVars");
  });

  it("Pro oculto: cores + favicon tenant, sem crédito plataforma", () => {
    const page = basePage({
      footer_branding: false,
      tenant_branding: {
        brand_name: "Acme",
        logo_url: "https://cdn.example.com/logo.png",
        favicon_url: "https://cdn.example.com/f.ico",
        primary_color: "#0F172A",
        accent_color: "#2563EB",
      },
    });
    const b = readPublicTenantBranding(page);
    expect(b?.brand_name).toBe("Acme");
    expect(shouldShowPlatformFooterBranding(page)).toBe(false);
    expect(tenantBrandingCssVars(b)).toMatchObject({
      "--tenant-primary": "#0F172A",
      "--tenant-accent": "#2563EB",
    });
    expect(resolvePublicPresellFaviconUrl(page)).toBe("https://cdn.example.com/f.ico");

    const html = buildPresellStandaloneHtml(page, {
      apiBase: "https://api.example.com/api",
      publicPageUrl: "https://www.example.com/p/wl-1",
      format: "document",
    });
    expect(html).toContain('data-tenant-wl="1"');
    expect(html).toContain("--tenant-primary:#0F172A");
    expect(html).toContain('data-testid="tenant-brand-chrome"');
    expect(html).toContain("https://cdn.example.com/logo.png");
    expect(html).not.toContain('data-testid="platform-footer-branding"');
    expect(html).toContain('rel="icon" href="https://cdn.example.com/f.ico"');
    expect(html).toContain('og:site_name" content="Acme"');
  });

  it("free: crédito plataforma + sem chrome se tenant null", () => {
    const page = basePage({
      footer_branding: true,
      tenant_branding: null,
    });
    expect(readPublicTenantBranding(page)).toBeNull();
    expect(shouldShowPlatformFooterBranding(page)).toBe(true);
    const html = buildPresellStandaloneHtml(page, {
      apiBase: "https://api.example.com/api",
      publicPageUrl: "https://www.example.com/p/wl-2",
      format: "document",
    });
    expect(html).toContain('data-testid="platform-footer-branding"');
    expect(html).toContain("dclickora");
    // CSS selector menciona data-tenant-wl; o atributo no root só existe com marca.
    expect(html).not.toMatch(/data-pe-presell-root="true"[^>]*data-tenant-wl="1"/);
    expect(html).not.toContain("--tenant-primary:");
  });
});
