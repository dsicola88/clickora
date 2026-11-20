import { afterEach, describe, expect, it } from "vitest";
import type { Presell } from "@/types/api";
import {
  applyPublicPresellHeadMetadata,
  extractIconHrefFromHtml,
  ogLocaleFromHtmlLang,
  resolvePublicPresellFaviconUrl,
  resolvePublicPresellOgLocale,
  stripSaasMarketingMetasFromHead,
} from "./publicPresellSeo";

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

describe("SEO público sem fuga SaaS + locale mercado", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("ogLocaleFromHtmlLang mapeia en-US/CA/AU/GB", () => {
    expect(ogLocaleFromHtmlLang("en-US")).toBe("en_US");
    expect(ogLocaleFromHtmlLang("en-CA")).toBe("en_CA");
    expect(ogLocaleFromHtmlLang("en-AU")).toBe("en_AU");
    expect(ogLocaleFromHtmlLang("en-GB")).toBe("en_GB");
  });

  it("resolvePublicPresellOgLocale usa marketCountry EN", () => {
    expect(resolvePublicPresellOgLocale(page({ productName: "X" }))).toBe("en_US");
    const withUs = page({ productName: "X" });
    withUs.settings = { marketCountry: "US" };
    expect(resolvePublicPresellOgLocale(withUs)).toBe("en_US");
    const withGb = page({ productName: "X" });
    withGb.settings = { marketCountry: "GB" };
    expect(resolvePublicPresellOgLocale(withGb)).toBe("en_GB");
    const withCa = page({ productName: "X" });
    withCa.settings = { marketCountry: "CA" };
    expect(resolvePublicPresellOgLocale(withCa)).toBe("en_CA");
    const withAu = page({ productName: "X" });
    withAu.settings = { marketCountry: "AU" };
    expect(resolvePublicPresellOgLocale(withAu)).toBe("en_AU");
  });

  it("strip + apply removem keywords/author/site_name dclickora", () => {
    document.head.innerHTML = `
      <meta name="keywords" content="ferramenta para afiliados, click tracker" />
      <meta name="author" content="dclickora" />
      <meta property="og:site_name" content="dclickora" />
      <meta property="og:image" content="https://www.dclickora.com/icon-512.png" />
    `;
    const p = page({
      generationNiche: "black",
      productName: "Melara Max",
      sourcePageTitle: "Adquira seu Melara Max hoje mesmo | Melara Max",
      subtitle: "Product overview for shoppers",
      productImages: ["https://cdn.example/product.jpg"],
    });
    p.settings = { marketCountry: "US" };
    const restore = applyPublicPresellHeadMetadata(p);
    expect(document.title).toBe("Melara Max");
    expect(document.querySelector('meta[name="keywords"]')).toBeNull();
    expect(document.querySelector('meta[name="author"]')).toBeNull();
    expect(document.querySelector('meta[property="og:site_name"]')).toBeNull();
    expect(document.querySelector('meta[property="og:locale"]')?.getAttribute("content")).toBe(
      "en_US",
    );
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toContain(
      "cdn.example/product.jpg",
    );
    restore();
    stripSaasMarketingMetasFromHead();
  });
});
