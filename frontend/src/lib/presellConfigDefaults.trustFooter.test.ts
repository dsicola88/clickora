import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESELL_CONFIG_SETTINGS,
  hydratePresellConfigSettings,
} from "./presellConfigDefaults";
import { isAffiliateTrustFooterEnabled } from "./presellAffiliateTrustFooter";

describe("showAffiliateTrustFooter hydrate / legado", () => {
  it("novas páginas no painel começam com rodapé desligado", () => {
    expect(DEFAULT_PRESELL_CONFIG_SETTINGS.showAffiliateTrustFooter).toBe(false);
  });

  it("sem a chave ao editar = rodapé desligado (opt-in)", () => {
    const h = hydratePresellConfigSettings({
      businessName: "Antiga Lda",
      contactEmail: "a@example.com",
    });
    expect(h.showAffiliateTrustFooter).toBe(false);
    expect(isAffiliateTrustFooterEnabled(h)).toBe(false);
  });

  it("respeita false explícito gravado na API", () => {
    const h = hydratePresellConfigSettings({ showAffiliateTrustFooter: false });
    expect(h.showAffiliateTrustFooter).toBe(false);
    expect(isAffiliateTrustFooterEnabled(h)).toBe(false);
  });

  it("respeita true explícito", () => {
    const h = hydratePresellConfigSettings({ showAffiliateTrustFooter: true });
    expect(h.showAffiliateTrustFooter).toBe(true);
  });

  it("hidrata marketCountry a partir de aliases (ads_country)", () => {
    expect(DEFAULT_PRESELL_CONFIG_SETTINGS.marketCountry).toBe("");
    expect(hydratePresellConfigSettings({ ads_country: "us" }).marketCountry).toBe("US");
    expect(hydratePresellConfigSettings({ marketCountry: "ca" }).marketCountry).toBe("CA");
    expect(hydratePresellConfigSettings({}).marketCountry).toBe("");
  });

  it("enterpriseCloak está descontinuado: fica sempre OFF (limpa configuração legada)", () => {
    expect(DEFAULT_PRESELL_CONFIG_SETTINGS.enterpriseCloak).toBe(false);
    expect(hydratePresellConfigSettings({}).enterpriseCloak).toBe(false);
    expect(hydratePresellConfigSettings({ enterpriseCloak: false }).enterpriseCloak).toBe(false);
    expect(hydratePresellConfigSettings({ enterpriseCloak: "false" }).enterpriseCloak).toBe(false);
    expect(hydratePresellConfigSettings({ enterpriseCloak: true }).enterpriseCloak).toBe(false);
    expect(hydratePresellConfigSettings({ enterpriseCloak: "true" }).enterpriseCloak).toBe(false);
  });
});
