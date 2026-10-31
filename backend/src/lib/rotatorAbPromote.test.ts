import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RotatorAbArmRow } from "./rotatorAbStats.service";

/** Espelha a lógica de escolha do vencedor (sem BD). */
function pickWinner(
  arms: RotatorAbArmRow[],
  metric: "conversion_rate" | "revenue",
  minClicks: number,
): string | null {
  const candidates = arms.filter((a) => a.current_weight > 0 && a.clicks >= minClicks);
  if (!candidates.length) return null;
  const score = (a: RotatorAbArmRow) =>
    metric === "revenue" ? parseFloat(a.revenue) || 0 : a.conversion_rate;
  candidates.sort((a, b) => score(b) - score(a) || a.order_index - b.order_index);
  return candidates[0]!.arm_id;
}

describe("rotator A/B promote winner", () => {
  const arms: RotatorAbArmRow[] = [
    {
      arm_id: "a",
      label: "A",
      order_index: 0,
      current_weight: 50,
      clicks: 100,
      conversions: 5,
      revenue: "50",
      conversion_rate: 0.05,
    },
    {
      arm_id: "b",
      label: "B",
      order_index: 1,
      current_weight: 50,
      clicks: 100,
      conversions: 20,
      revenue: "40",
      conversion_rate: 0.2,
    },
  ];

  it("promove por conversion_rate", () => {
    assert.equal(pickWinner(arms, "conversion_rate", 10), "b");
  });

  it("promove por revenue", () => {
    assert.equal(pickWinner(arms, "revenue", 10), "a");
  });

  it("respeita min_clicks", () => {
    assert.equal(pickWinner(arms, "conversion_rate", 500), null);
  });
});
