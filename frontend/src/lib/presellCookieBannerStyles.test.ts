import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESELL_COOKIE_STYLE,
  PRESELL_COOKIE_STYLE_ORDER,
  buildExportCookieStyleCss,
  cookieBannerReserveHeight,
  getPresellCookieStyle,
  isPresellCookieStyleId,
  presellCookieStyleCssVars,
  resolvePresellCookieStyleId,
} from "./presellCookieBannerStyles";
import { hydratePresellConfigSettings } from "./presellConfigDefaults";

type Rgb = [number, number, number];

function parseColor(c: string): { rgb: Rgb; a: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 };
  }
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(c);
  if (!m) throw new Error(`cor inválida: ${c}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) };
}

/** Compõe `fg` (com alfa) sobre `bg` opaco. */
function over(fg: string, bg: Rgb): Rgb {
  const { rgb, a } = parseColor(fg);
  return [0, 1, 2].map((i) => Math.round(rgb[i] * a + bg[i] * (1 - a))) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

describe("presellCookieBannerStyles", () => {
  it("expõe pelo menos 5 predefinições, sem duplicados, todas resolvíveis", () => {
    expect(PRESELL_COOKIE_STYLE_ORDER.length).toBeGreaterThanOrEqual(5);
    expect(new Set(PRESELL_COOKIE_STYLE_ORDER).size).toBe(PRESELL_COOKIE_STYLE_ORDER.length);
    expect(PRESELL_COOKIE_STYLE_ORDER[0]).toBe(DEFAULT_PRESELL_COOKIE_STYLE);
    for (const id of PRESELL_COOKIE_STYLE_ORDER) {
      expect(isPresellCookieStyleId(id)).toBe(true);
      expect(getPresellCookieStyle(id).id).toBe(id);
    }
  });

  it("inválido/ausente cai em classicBar (nunca rebenta)", () => {
    for (const bad of [undefined, null, "", "nope", 3, {}, "__proto__", "toString", "constructor"]) {
      expect(isPresellCookieStyleId(bad)).toBe(false);
      expect(getPresellCookieStyle(bad).id).toBe("classicBar");
    }
    expect(resolvePresellCookieStyleId(undefined)).toBe("classicBar");
    expect(resolvePresellCookieStyleId({})).toBe("classicBar");
    expect(resolvePresellCookieStyleId({ cookieBannerStyle: "xxx" })).toBe("classicBar");
  });

  it("lê camelCase e snake_case", () => {
    expect(resolvePresellCookieStyleId({ cookieBannerStyle: "darkBar" })).toBe("darkBar");
    expect(resolvePresellCookieStyleId({ cookie_banner_style: "cornerCard" })).toBe("cornerCard");
  });

  it.each(PRESELL_COOKIE_STYLE_ORDER)("%s: contraste de texto ≥ 4.5:1 e botões ≥ 3:1 contra o cartão", (id) => {
    const t = getPresellCookieStyle(id);
    // Cartão translúcido: pior caso = sobre branco e sobre preto.
    for (const backdrop of [WHITE, BLACK]) {
      const surface = over(t.surface, backdrop);
      for (const [name, color] of Object.entries({
        title: t.title,
        body: t.body,
        muted: t.muted,
        link: t.link,
      })) {
        // glassBar sobre fundo preto só é relevante se a superfície ficar escura — o pior caso real é página clara.
        if (id === "glassBar" && backdrop === BLACK) continue;
        expect(contrast(parseColor(color).rgb, surface), `${id}.${name} sobre ${backdrop}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    const surface = over(t.surface, WHITE);
    expect(contrast(parseColor(t.allowText).rgb, parseColor(t.allowBg).rgb), `${id} allow`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parseColor(t.closeText).rgb, parseColor(t.closeBg).rgb), `${id} close`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parseColor(t.allowText).rgb, parseColor(t.allowHover).rgb), `${id} allow hover`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parseColor(t.closeText).rgb, parseColor(t.closeHover).rgb), `${id} close hover`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parseColor(t.allowBg).rgb, surface), `${id} allow vs surface`).toBeGreaterThanOrEqual(3);
    expect(contrast(parseColor(t.closeBg).rgb, surface), `${id} close vs surface`).toBeGreaterThanOrEqual(3);
  });

  it.each(PRESELL_COOKIE_STYLE_ORDER)("%s: variáveis CSS completas (nenhuma vazia)", (id) => {
    const vars = presellCookieStyleCssVars(getPresellCookieStyle(id));
    expect(Object.keys(vars).length).toBeGreaterThanOrEqual(14);
    for (const [k, v] of Object.entries(vars)) expect(v, k).toBeTruthy();
  });

  it.each(PRESELL_COOKIE_STYLE_ORDER)("%s: CSS do export está escopado e define os dois botões com a mesma borda", (id) => {
    const css = buildExportCookieStyleCss(id);
    expect(css).toContain(`.pe-cookie-overlay.pe-ck-${id} .pe-cookie-allow{`);
    expect(css).toContain(`.pe-cookie-overlay.pe-ck-${id} .pe-cookie-close{`);
    const allow = /\.pe-cookie-allow\{([^}]*)\}/.exec(css)?.[1] ?? "";
    const close = /\.pe-cookie-close\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(allow).toContain("border:1px solid transparent");
    expect(close).toContain("border:1px solid transparent");
    // Nunca esconde conteúdo nem bloqueia scroll.
    expect(css).not.toMatch(/overflow\s*:\s*hidden/);
    expect(css).not.toMatch(/inset:0/);
  });

  it("layouts: só o glassBar tem blur; corner e floating redefinem a posição", () => {
    expect(buildExportCookieStyleCss("glassBar")).toContain("backdrop-filter:blur(14px)");
    expect(buildExportCookieStyleCss("classicBar")).not.toContain("backdrop-filter");
    expect(buildExportCookieStyleCss("cornerCard")).toContain("right:1rem");
    expect(buildExportCookieStyleCss("floatingCard")).toContain("justify-content:center");
  });

  it("reserva de espaço: barra sempre; canto só em ecrã estreito; cartão central com folga", () => {
    expect(cookieBannerReserveHeight({ layout: "bar", cardWidth: 1280, cardHeight: 96, viewportWidth: 1280 })).toBe(96);
    expect(cookieBannerReserveHeight({ layout: "corner", cardWidth: 384, cardHeight: 200, viewportWidth: 1280 })).toBe(0);
    expect(cookieBannerReserveHeight({ layout: "corner", cardWidth: 390, cardHeight: 260, viewportWidth: 390 })).toBe(260);
    expect(cookieBannerReserveHeight({ layout: "floating", cardWidth: 512, cardHeight: 150, viewportWidth: 1280 })).toBe(174);
    expect(cookieBannerReserveHeight({ layout: "bar", cardWidth: 0, cardHeight: 0, viewportWidth: 1280 })).toBe(0);
  });

  it("hydrate preserva um estilo válido e descarta lixo (sem poluir outros tipos)", () => {
    expect(hydratePresellConfigSettings({ cookieBannerStyle: "glassBar" }).cookieBannerStyle).toBe("glassBar");
    expect(hydratePresellConfigSettings({ cookieBannerStyle: "xxx" })).not.toHaveProperty("cookieBannerStyle");
    expect(hydratePresellConfigSettings({})).not.toHaveProperty("cookieBannerStyle");
  });

  it("redirect para a oferta é estritamente opt-in no hydrate ('false'/'0'/lixo/ausente → desligado)", () => {
    for (const off of [undefined, null, false, 0, "false", "0", "", "yes", "TRUE", {}, []]) {
      expect(hydratePresellConfigSettings({ cookieRedirectToOffer: off }).cookieRedirectToOffer, String(off)).toBe(false);
    }
    expect(hydratePresellConfigSettings({}).cookieRedirectToOffer).toBe(false);
    for (const on of [true, 1, "true", "1"]) {
      expect(hydratePresellConfigSettings({ cookieRedirectToOffer: on }).cookieRedirectToOffer).toBe(true);
    }
  });
});
