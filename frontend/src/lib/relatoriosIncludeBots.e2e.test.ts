/**
 * Regressão: Relatórios Situação precisa de include_bots=1 —
 * senão cloud (exclude_from_kpi) e bots nunca aparecem na UI / botão Google Ads.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("E2E Relatorios include_bots (contrato)", () => {
  it("Relatorios.tsx pede include_bots em listagens e CSV", () => {
    const src = readFileSync(resolve(__dirname, "../pages/Relatorios.tsx"), "utf8");
    const hits = src.match(/include_bots:\s*true/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(5);
  });

  it("health panel aponta para rota canónica de cliques", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/presell/PresellTrackingHealthPanel.tsx"),
      "utf8",
    );
    expect(src).toContain('to="/resultados/relatorios/cliques"');
    expect(src).not.toContain('to="/tracking/relatorios/cliques"');
  });
});
