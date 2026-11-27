import { afterEach, describe, expect, it } from "vitest";
import { buildPresellStandaloneHtml } from "./presellExportHtml";
import { buildExportCookieModalBindingsScript } from "./presellExportConsentBoot";
import { PRESELL_COOKIE_STYLE_ORDER } from "./presellCookieBannerStyles";
import type { Presell } from "@/types/api";

const exportOpts = {
  apiBase: "https://api.example.com",
  publicPageUrl: "https://app.example.com/p/e2e-cookie-style",
  format: "document" as const,
};

function page(type: string, settings: Record<string, unknown> = {}): Presell {
  return {
    id: "e2e-cookie-style",
    title: "Export",
    slug: "export-cookie-style",
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

afterEach(() => {
  document.body.innerHTML = "";
  document.body.style.removeProperty("padding-bottom");
  window.localStorage.clear();
  delete (window as unknown as Record<string, unknown>).__clickoraCookieConsent;
});

describe("export estático — predefinições do banner de cookies", () => {
  it.each(PRESELL_COOKIE_STYLE_ORDER)("%s: classe, CSS e atributos no HTML exportado", (id) => {
    const html = buildPresellStandaloneHtml(page("cookies", { cookieBannerStyle: id }), exportOpts);
    expect(html).toContain(`class="pe-cookie-overlay pe-ck-${id}"`);
    expect(html).toContain(`data-cookie-style="${id}"`);
    expect(html).toContain(`.pe-cookie-overlay.pe-ck-${id} .pe-cookie-allow{`);
    // Medição/CTA intactos: sem navegação forçada e sem backdrop clicável.
    expect(html).not.toMatch(/location\.assign/);
    expect(html).toContain('<button type="button" class="pe-cookie-allow" id="pe-cookie-allow">');
    expect(html).toContain('id="pe-cookie-close"');
  });

  it.each(PRESELL_COOKIE_STYLE_ORDER)("%s: opt-in mantém Aceitar como link nativo", (id) => {
    const html = buildPresellStandaloneHtml(
      page("cookies", { cookieBannerStyle: id, cookieRedirectToOffer: true }),
      exportOpts,
    );
    expect(html).toMatch(/<a class="pe-cookie-allow" id="pe-cookie-allow" href="[^"]+"/);
    expect(html).toContain(`pe-ck-${id}`);
  });

  it("sem estilo guardado → classicBar; estilo inválido → classicBar", () => {
    expect(buildPresellStandaloneHtml(page("cookies"), exportOpts)).toContain("pe-ck-classicBar");
    expect(buildPresellStandaloneHtml(page("cookies", { cookieBannerStyle: "xx" }), exportOpts)).toContain(
      "pe-ck-classicBar",
    );
  });

  it("outros tipos não recebem CSS/markup do banner", () => {
    const html = buildPresellStandaloneHtml(page("review", { cookieBannerStyle: "darkBar" }), exportOpts);
    expect(html).not.toContain("pe-ck-darkBar");
    expect(html).not.toContain('id="pe-cookie-overlay"');
  });

  it("cores do estilo escolhido chegam ao CSS (darkBar escuro, não o clássico)", () => {
    const html = buildPresellStandaloneHtml(page("cookies", { cookieBannerStyle: "darkBar" }), exportOpts);
    expect(html).toContain(".pe-cookie-overlay.pe-ck-darkBar .pe-cookie-card{background:#0f172a;");
  });
});

describe("export estático — script do banner (executado em jsdom)", () => {
  function mount(layout: "bar" | "corner" | "floating") {
    document.body.innerHTML = `<div id="pe-cookie-overlay"><div id="pe-cookie-card"></div>
      <button id="pe-cookie-close"></button><button id="pe-cookie-allow"></button></div><button id="pe-cookie-reopen"></button>`;
    const calls: string[] = [];
    (window as unknown as Record<string, unknown>).__clickoraCookieConsent = {
      accept: () => {
        calls.push("accept");
        document.getElementById("pe-cookie-overlay")!.style.display = "none";
      },
      essential: () => {
        calls.push("essential");
        document.getElementById("pe-cookie-overlay")!.style.display = "none";
      },
      reopen: () => {
        calls.push("reopen");
        document.getElementById("pe-cookie-overlay")!.style.display = "";
      },
    };
    const js = buildExportCookieModalBindingsScript(layout).replace(/^<script>|<\/script>$/g, "");
    new Function(js)();
    return calls;
  }

  it("reserva espaço enquanto visível e liberta ao aceitar/fechar; reabrir volta a reservar", () => {
    const card = () => document.getElementById("pe-cookie-card")!;
    const orig = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { width: window.innerWidth, height: 90, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
    };
    try {
      const calls = mount("bar");
      expect(card()).toBeTruthy();
      expect(document.body.style.getPropertyValue("padding-bottom")).toBe("90px");
      document.getElementById("pe-cookie-close")!.click();
      expect(calls).toEqual(["essential"]);
      expect(document.body.style.getPropertyValue("padding-bottom")).toBe("");
      document.getElementById("pe-cookie-reopen")!.click();
      expect(document.body.style.getPropertyValue("padding-bottom")).toBe("90px");
      document.getElementById("pe-cookie-allow")!.click();
      expect(calls).toEqual(["essential", "reopen", "accept"]);
      expect(document.body.style.getPropertyValue("padding-bottom")).toBe("");
    } finally {
      HTMLElement.prototype.getBoundingClientRect = orig;
    }
  });

  it("Aceitar guardado → banner escondido e botão «Cookie settings» visível", () => {
    window.localStorage.setItem("clickora-cookie-banner:choice", "all");
    mount("bar");
    expect(document.getElementById("pe-cookie-overlay")!.style.display).toBe("none");
    expect(document.getElementById("pe-cookie-reopen")!.style.display).not.toBe("none");
  });

  it("só «Fechar» (essencial) guardado → banner volta EXPANDIDO, sem chip minimizado", () => {
    window.localStorage.setItem("clickora-cookie-banner:choice", "essential");
    mount("bar");
    expect(document.getElementById("pe-cookie-overlay")!.style.display).not.toBe("none");
    expect(document.getElementById("pe-cookie-reopen")!.style.display).toBe("none");
  });

  it("sem escolha guardada → banner visível", () => {
    mount("bar");
    expect(document.getElementById("pe-cookie-overlay")!.style.display).not.toBe("none");
  });
});
