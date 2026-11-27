import { describe, expect, it } from "vitest";
import { buildPresellStandaloneHtml } from "./presellExportHtml";
import { PRESELL_COOKIE_STYLE_ORDER } from "./presellCookieBannerStyles";
import type { Presell } from "@/types/api";

/**
 * Guarda de conformidade Google Ads («site comprometido» / destination experience):
 * o HTML exportado, por defeito, não pode conter navegação sem clique, troca de landing por UA/bot,
 * <base>/meta refresh, iframes, escrita de cookies HTTP, eval nem listeners de rato/scroll.
 */
const TYPES = [
  "review", "cookies", "desconto", "fantasma", "tsl", "vsl", "vsl_tsl", "dtc",
  "advertorial", "landing", "idade", "pais", "segmentacao",
];

const FORBIDDEN: [string, RegExp][] = [
  ["navegação por JS (location.assign/replace/href=)", /location\s*\.\s*(assign|replace)\s*\(|location\s*\.\s*href\s*=/],
  ["meta refresh", /http-equiv=["']?refresh/i],
  ["<base>", /<base[\s>]/i],
  ["document.cookie", /document\.cookie/],
  ["iframe", /<iframe/i],
  ["listeners de rato/scroll/toque", /["'](mousemove|pointermove|touchmove|wheel|scroll)["']/],
  ["eval / new Function", /\beval\(|new Function\(/],
  ["window.open", /window\.open\(/],
  ["detecção de bot/UA", /googlebot|adsbot|user-?agent/i],
];

const opts = {
  apiBase: "https://api.example.com",
  publicPageUrl: "https://app.example.com/p/ads-safety",
  format: "document" as const,
};

function page(type: string, settings: Record<string, unknown> = {}): Presell {
  return {
    id: "ads-safety",
    title: "T",
    slug: "ads-safety",
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
      title: "P",
      productName: "P",
      salesText: "Texto.",
      ctaText: "See offer",
      affiliateLink: "https://example.com/offer",
      images: [],
    },
  } as unknown as Presell;
}

function violations(html: string): string[] {
  return FORBIDDEN.filter(([, re]) => re.test(html)).map(([name]) => name);
}

describe("export estático — segurança Google Ads (defaults)", () => {
  it.each(TYPES)("%s: sem padrões de navegação/cloaking/injeção", (type) => {
    expect(violations(buildPresellStandaloneHtml(page(type), opts))).toEqual([]);
  });

  it.each(PRESELL_COOKIE_STYLE_ORDER)("cookies/%s: banner novo não introduz nenhum padrão proibido", (style) => {
    expect(violations(buildPresellStandaloneHtml(page("cookies", { cookieBannerStyle: style }), opts))).toEqual([]);
  });

  it.each(TYPES)("%s: nenhum texto público anuncia redirect/gesto", (type) => {
    const text = buildPresellStandaloneHtml(page(type), opts).replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/redireciona no primeiro gesto|redirect on the first gesture|antibloqueio|cloaking/i);
  });

  it("fantasma com rodapé ligado mostra a mesma divulgação que review", () => {
    const trust = (h: string) => (h.match(/class="pe-trust[^"]*"/g) ?? []).length;
    const on = { showAffiliateTrustFooter: true };
    const ghost = buildPresellStandaloneHtml(page("fantasma", on), opts);
    const review = buildPresellStandaloneHtml(page("review", on), opts);
    expect(trust(review)).toBeGreaterThan(0);
    expect(trust(ghost)).toBe(trust(review));
  });

  it("com opt-in o Aceitar continua a ser link nativo (sem JS de navegação)", () => {
    const html = buildPresellStandaloneHtml(page("cookies", { cookieRedirectToOffer: true }), opts);
    expect(html).toMatch(/<a class="pe-cookie-allow" id="pe-cookie-allow" href="[^"]+"/);
    expect(violations(html)).toEqual([]);
  });
});
