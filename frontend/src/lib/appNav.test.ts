import { describe, expect, it } from "vitest";
import {
  APP_NAV_ITEMS,
  appNavMatchesQuery,
  appNavSearchValue,
  isAppNavActive,
  normalizeNavSearchText,
  sidebarNavItems,
} from "./appNav";

describe("appNav", () => {
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

    expect(isAppNavActive("/resultados/relatorios", "/resultados/relatorios/acessos")).toBe(true);
    expect(isAppNavActive("/resultados/relatorios", "/resultados/relatorios/conversoes")).toBe(false);
    expect(isAppNavActive("/resultados/relatorios/conversoes", "/resultados/relatorios/conversoes", true)).toBe(
      true,
    );
  });

  it("sidebar omite itens avançados; inclui staff só quando pedido", () => {
    const user = sidebarNavItems(false);
    expect(user.some((i) => i.url === "/tracking/rotadores")).toBe(false);
    expect(user.some((i) => i.url === "/admin/overview")).toBe(false);
    expect(user.some((i) => i.url === "/presells")).toBe(true);

    const staff = sidebarNavItems(true);
    expect(staff.some((i) => i.url === "/admin/overview")).toBe(true);
  });
});
