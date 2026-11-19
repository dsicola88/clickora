import { describe, expect, it } from "vitest";
import {
  APP_NAV_ITEMS,
  appNavMatchesQuery,
  appNavSearchValue,
  commandNavItems,
  isAppNavActive,
  normalizeNavSearchText,
  sidebarNavItems,
} from "./appNav";

describe("appNav", () => {
  it("commandNavItems inclui Ads Studio (PlanGate na página)", () => {
    const withoutPlan = commandNavItems(false, { dpilotAdsEnabled: false });
    const withPlan = commandNavItems(false, { dpilotAdsEnabled: true });
    expect(withoutPlan.some((i) => i.url === "/tracking/dpilot")).toBe(true);
    expect(withPlan.some((i) => i.url === "/tracking/dpilot")).toBe(true);
  });

  it("sidebar mostra Ads Studio sempre (upgrade no PlanGate)", () => {
    const withoutPlan = sidebarNavItems(false, { dpilotAdsEnabled: false });
    const withPlan = sidebarNavItems(false, { dpilotAdsEnabled: true });
    expect(withoutPlan.some((i) => i.url === "/tracking/dpilot")).toBe(true);
    const item = withPlan.find((i) => i.url === "/tracking/dpilot");
    expect(item?.group).toBe("trabalho");
    expect(item?.sidebarBadge).toBe("Google");
  });

  it("normalizeNavSearchText remove acentos", () => {
    expect(normalizeNavSearchText("Integrações")).toBe("integracoes");
    expect(normalizeNavSearchText("Conversões")).toBe("conversoes");
  });

  it("pesquisa encontra postback e integrações sem acento", () => {
    const postback = APP_NAV_ITEMS.find((i) => i.url === "/integracoes/postback");
    const integracoes = APP_NAV_ITEMS.find((i) => i.url === "/integracoes");
    expect(postback && appNavMatchesQuery(postback, "maxweb")).toBe(true);
    expect(postback && appNavMatchesQuery(postback, "POSTBACK")).toBe(true);
    expect(integracoes && appNavMatchesQuery(integracoes, "integracoes")).toBe(true);
  });

  it("cada item de pesquisa tem valor único", () => {
    const values = APP_NAV_ITEMS.map(appNavSearchValue);
    expect(new Set(values).size).toBe(values.length);
  });

  it("isAppNavActive: Resultados exacto; Relatórios sem Conversões", () => {
    expect(isAppNavActive("/resultados", "/resultados", true)).toBe(true);
    expect(isAppNavActive("/resultados", "/resultados/relatorios", true)).toBe(false);

    expect(isAppNavActive("/resultados/funil", "/resultados/funil", true)).toBe(true);
    expect(isAppNavActive("/resultados", "/resultados/funil", true)).toBe(false);

    expect(isAppNavActive("/resultados/relatorios", "/resultados/relatorios/acessos")).toBe(true);
    expect(isAppNavActive("/resultados/relatorios", "/resultados/relatorios/conversoes")).toBe(false);
    expect(isAppNavActive("/resultados/relatorios/conversoes", "/resultados/relatorios/conversoes", true)).toBe(
      true,
    );
  });

  it("pesquisa encontra Funil", () => {
    const funil = APP_NAV_ITEMS.find((i) => i.url === "/resultados/funil");
    expect(funil && appNavMatchesQuery(funil, "funnel")).toBe(true);
    expect(funil && appNavMatchesQuery(funil, "checkout")).toBe(true);
  });

  it("sidebar omite itens avançados; inclui staff só quando pedido", () => {
    const user = sidebarNavItems(false);
    expect(user.some((i) => i.url === "/tracking/rotadores")).toBe(false);
    expect(user.some((i) => i.url === "/admin/overview")).toBe(false);
    expect(user.some((i) => i.url === "/presells")).toBe(true);
    expect(user.some((i) => i.url === "/radar-demanda")).toBe(true);

    const staff = sidebarNavItems(true);
    expect(staff.some((i) => i.url === "/admin/overview")).toBe(true);
  });

  it("pesquisa encontra radar de demanda", () => {
    const radar = APP_NAV_ITEMS.find((i) => i.url === "/radar-demanda");
    expect(radar && appNavMatchesQuery(radar, "adscore")).toBe(true);
    expect(radar && appNavMatchesQuery(radar, "planejador")).toBe(true);
  });
});
