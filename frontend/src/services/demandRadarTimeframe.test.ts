import { describe, expect, it } from "vitest";
import { normalizeDemandTimeframe } from "./demandRadarService";

describe("normalizeDemandTimeframe", () => {
  it("alinha default e vazio a last_12", () => {
    expect(normalizeDemandTimeframe("default")).toBe("last_12");
    expect(normalizeDemandTimeframe(undefined)).toBe("last_12");
    expect(normalizeDemandTimeframe(null)).toBe("last_12");
  });

  it("preserva janelas explícitas", () => {
    expect(normalizeDemandTimeframe("last_1")).toBe("last_1");
    expect(normalizeDemandTimeframe("last_12")).toBe("last_12");
    expect(normalizeDemandTimeframe("last_24")).toBe("last_24");
    expect(normalizeDemandTimeframe("all_available")).toBe("all_available");
  });
});
