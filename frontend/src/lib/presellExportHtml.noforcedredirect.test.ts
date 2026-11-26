import { describe, expect, it } from "vitest";
import { buildPresellStandaloneHtml } from "./presellExportHtml";
import type { Presell } from "@/types/api";

const exportOpts = {
  apiBase: "https://api.example.com",
  publicPageUrl: "https://app.example.com/p/e2e-noredirect",
  format: "document" as const,
};

function page(type: string, settings: Record<string, unknown> = {}): Presell {
  return {
    id: "e2e-noredirect",
    title: "Export",
    slug: "export-noredirect",
    type,
    category: "health",
    language: "en",
    status: "published",
    clicks: 0,
    impressions: 0,
    conversions: 0,
    settings,
    tracking: { offerUrl: "https://example.com/offer" },
    footer_branding: false,
    created_at: "2026-11-13T00:00:00.000Z",
    updated_at: "2026-11-13T00:00:00.000Z",
    content: {
      title: "Produto",
      productName: "Produto",
      salesText: "Texto de venda.",
      ctaText: "See offer",
      affiliateLink: "https://example.com/offer",
      images: [],
    },
  } as unknown as Presell;
}

/** Google Ads: a navegação para a oferta só pode acontecer por clique intencional num link nativo. */
describe("buildPresellStandaloneHtml — sem redirecionamentos forçados", () => {
  it("tipo fantasma não redireciona por mousemove/scroll/touch", () => {
    const html = buildPresellStandaloneHtml(page("fantasma"), exportOpts);
    expect(html).not.toMatch(/addEventListener\(ev,go/);
    expect(html).not.toMatch(/"mousemove"|"pointermove"|"touchmove"|"wheel"/);
    expect(html).not.toMatch(/location\.href\s*=/);
  });

  it("desconto: X e fundo fecham o overlay e nunca navegam", () => {
    const html = buildPresellStandaloneHtml(page("desconto"), exportOpts);
    expect(html).toContain('id="pe-discount-close"');
    expect(html).not.toMatch(/location\.assign/);
    expect(html).not.toMatch(/<a [^>]*class="pe-close-x"/);
    expect(html).toMatch(/style\.display="none"/);
  });

  it("cookies: por defeito Aceitar é botão e não navega", () => {
    const html = buildPresellStandaloneHtml(page("cookies"), exportOpts);
    expect(html).toContain('<button type="button" class="pe-cookie-allow" id="pe-cookie-allow">');
    expect(html).not.toMatch(/<a class="pe-cookie-allow"/);
    expect(html).not.toMatch(/location\.assign/);
  });

  it("cookies: com cookieRedirectToOffer (opt-in) Aceitar é link nativo para /track/r/ — sem redirect automático", () => {
    const html = buildPresellStandaloneHtml(
      page("cookies", { cookieRedirectToOffer: true }),
      exportOpts,
    );
    expect(html).toMatch(/<a class="pe-cookie-allow" id="pe-cookie-allow" href="[^"]*\/track\/r\/[^"]*"/);
    expect(html).not.toMatch(/location\.assign/);
    expect(html).not.toMatch(/location\.href\s*=/);
  });
});
