import { describe, expect, it } from "vitest";
import { getPresellTypeEditorial, getPresellTypeTheme } from "./presellTypeTheme";
import { PRESELL_TYPE_OPTIONS } from "./presellTypeOptions";

describe("presellTypeTheme", () => {
  it("cada tipo de oferta tem tema distinto (badge / hero)", () => {
    const offerTypes = ["tsl", "dtc", "review", "advertorial", "desconto", "vsl", "vsl_tsl", "cookies"];
    const badges = new Set(offerTypes.map((t) => getPresellTypeTheme(t).badge));
    const heros = new Set(offerTypes.map((t) => getPresellTypeTheme(t).heroBg));
    expect(badges.size).toBe(offerTypes.length);
    expect(heros.size).toBe(offerTypes.length);
  });

  it("editorial de review e advertorial reforçam independência", () => {
    const ed = getPresellTypeEditorial("review", "pt-BR");
    expect(ed?.points.some((p) => /não é o site oficial|independente/i.test(p))).toBe(true);
    const ad = getPresellTypeEditorial("advertorial", "pt-BR");
    expect(ad?.title).toMatch(/artigo/i);
    expect(ad?.points.some((p) => /não é o site oficial|vendedor/i.test(p))).toBe(true);
  });

  it("catálogo de tipos cobre ids estáveis", () => {
    expect(PRESELL_TYPE_OPTIONS.map((t) => t.id)).toContain("fantasma");
    expect(PRESELL_TYPE_OPTIONS.find((t) => t.id === "fantasma")?.description).toMatch(/risco elevado/i);
  });
});
