import { describe, expect, it } from "vitest";
import type { Presell } from "@/types/api";
import { extractIconHrefFromHtml, resolvePublicPresellFaviconUrl } from "./publicPresellSeo";

function page(content: Record<string, unknown>): Presell {
  return {
    id: "1",
    title: "Campanha",
    slug: "x",
    type: "cookies",
    category: "sem",
    language: "en",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    content,
    settings: {},
    tracking: {},
    created_at: "",
    updated_at: "",
  };
}

describe("favicon público da presell", () => {
  it("não usa o svg da app; prefere apple-touch da origem", () => {
    const href = extractIconHrefFromHtml(
      `<link rel="icon" href="/favicon.svg"><link rel="apple-touch-icon" sizes="180x180" href="/product-icon.png">`,
      "https://visivra.net/",
    );
    expect(href).toBe("https://visivra.net/product-icon.png");
  });

  it("cai na foto do produto quando não há ícone importado", () => {
    const href = resolvePublicPresellFaviconUrl(
      page({
        productImages: ["https://cdn.example/bottle.webp"],
      }),
    );
    expect(href).toBe("https://cdn.example/bottle.webp");
  });

  it("usa imagem do espelho quando não há productImages nem favicon", () => {
    const href = resolvePublicPresellFaviconUrl(
      page({
        sourceUrl: "https://mwebkivo.com/offer/",
        importMirrorSrcDoc: `<html><head><base href="https://cdn.example/"></head><body><img src="https://cdn.example/visivra-bottle.webp" alt="pack"></body></html>`,
      }),
    );
    expect(href).toBe("https://cdn.example/visivra-bottle.webp");
  });

  it("usa faviconUrl guardado no import", () => {
    const href = resolvePublicPresellFaviconUrl(
      page({
        faviconUrl: "https://visivra.net/apple-touch-icon.png",
        productImages: ["https://cdn.example/bottle.webp"],
      }),
    );
    expect(href).toBe("https://visivra.net/apple-touch-icon.png");
  });

  it("usa favicon white-label do tenant quando não há ícone da página", () => {
    const p = page({ productImages: [] });
    p.tenant_branding = {
      brand_name: "Acme",
      favicon_url: "https://cdn.example/tenant-icon.png",
      logo_url: "https://cdn.example/logo.png",
    };
    expect(resolvePublicPresellFaviconUrl(p)).toBe("https://cdn.example/tenant-icon.png");
  });
});
