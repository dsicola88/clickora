import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLocaleProvider } from "@/i18n/AppLocaleProvider";
import { CookieBannerStylePicker } from "./CookieBannerStylePicker";
import { PRESELL_COOKIE_STYLE_ORDER } from "@/lib/presellCookieBannerStyles";
import { hydratePresellConfigSettings } from "@/lib/presellConfigDefaults";

afterEach(cleanup);

function renderPicker(value: string | null | undefined, onChange = vi.fn()) {
  render(
    <AppLocaleProvider>
      <CookieBannerStylePicker value={value} onChange={onChange} />
    </AppLocaleProvider>,
  );
  return onChange;
}

describe("CookieBannerStylePicker", () => {
  it("mostra todas as predefinições (≥5) como radios, com a recomendada marcada por defeito", () => {
    renderPicker(undefined);
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(PRESELL_COOKIE_STYLE_ORDER.length);
    expect(radios.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByTestId("cookie-style-option-classicBar").getAttribute("aria-checked")).toBe("true");
  });

  it("valor inválido mostra classicBar selecionado", () => {
    renderPicker("lixo");
    expect(screen.getByTestId("cookie-style-option-classicBar").getAttribute("aria-checked")).toBe("true");
  });

  it.each(PRESELL_COOKIE_STYLE_ORDER)("escolher %s chama onChange com esse id", (id) => {
    const onChange = renderPicker("classicBar");
    const opt = screen.getByTestId(`cookie-style-option-${id}`);
    fireEvent.click(opt);
    if (id === "classicBar") expect(onChange).not.toHaveBeenCalled();
    else expect(onChange).toHaveBeenCalledWith(id);
  });
});

/** Ponta a ponta no código: seletor → settings → gravação → leitura → página pública/export. */
describe("cookieBannerStyle — ligações ponta a ponta", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("assistente: estado, seletor e gravação (A e variante B)", () => {
    const src = read("src/pages/CreatePresellWizardPage.tsx");
    expect(src).toContain("<CookieBannerStylePicker");
    expect(src).toMatch(/type === "cookies" \? \{ cookieRedirectToOffer, cookieBannerStyle \}/);
    expect(src).toMatch(/typeB === "cookies" \? \{ cookieRedirectToOffer, cookieBannerStyle \}/);
    expect(src).toContain("delete settingsB.cookieBannerStyle");
  });

  it("editor: carrega, mostra seletor e grava só para o tipo cookies", () => {
    const src = read("src/pages/PresellDashboard.tsx");
    expect(src).toContain("<CookieBannerStylePicker");
    expect(src).toContain("cookieBannerStyle: resolvePresellCookieStyleId(settings");
    expect(src).toContain("base.cookieBannerStyle = typeOptions.cookieBannerStyle");
    expect(src).toContain("delete base.cookieBannerStyle");
  });

  it("página pública e export leem o estilo guardado", () => {
    const pub = read("src/pages/PublicPresell.tsx");
    expect(pub.match(/styleId=\{resolvePresellCookieStyleId\(settings\)\}/g)?.length).toBe(2);
    const exp = read("src/lib/presellExportHtml.ts");
    expect(exp).toContain("buildExportCookieStyleCss(resolvePresellCookieStyleId(settings))");
    expect(exp).toContain("resolvePresellCookieStyleId(settings));");
  });

  it("gravar no editor não perde o estilo (hydrate → spread → save)", () => {
    const hydrated = hydratePresellConfigSettings({ cookieBannerStyle: "floatingCard", cookieRedirectToOffer: true });
    expect(hydrated.cookieBannerStyle).toBe("floatingCard");
    expect(hydrated.cookieRedirectToOffer).toBe(true);
  });
});
