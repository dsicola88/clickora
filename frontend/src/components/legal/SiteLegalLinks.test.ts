import { describe, expect, it } from "vitest";
import { REQUIRED_SITE_LEGAL_LINKS, withRequiredSiteLegalLinks } from "./SiteLegalLinks";

describe("withRequiredSiteLegalLinks", () => {
  it("acrescenta Planos, Termos e Privacidade quando o admin não os tem", () => {
    const out = withRequiredSiteLegalLinks([{ label: "Criar conta", href: "/auth" }]);
    expect(out.map((l) => l.href)).toEqual(["/auth", "/planos", "/termos", "/privacidade"]);
  });

  it("não duplica links já presentes (incluindo /plans e barras finais)", () => {
    const out = withRequiredSiteLegalLinks([
      { label: "Preços", href: "/plans" },
      { label: "Termos", href: "/termos/" },
      { label: "Privacidade", href: "/privacidade?x=1" },
    ]);
    expect(out).toHaveLength(3);
  });

  it("sem links do admin devolve só os obrigatórios", () => {
    expect(withRequiredSiteLegalLinks(null)).toEqual([...REQUIRED_SITE_LEGAL_LINKS]);
  });
});
