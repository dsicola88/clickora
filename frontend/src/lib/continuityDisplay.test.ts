import { describe, expect, it } from "vitest";
import { formatUptime, presellsAtRisk, uptimeTone } from "./continuityDisplay";
import type { ContinuityOverviewDto } from "@/types/api";

type Presell = ContinuityOverviewDto["presells"][number];

const presell = (id: string, risk: Presell["risk"]): Presell => ({
  id,
  title: id,
  slug: id,
  status: "published",
  canonical_domain_id: null,
  canonical_hostname: null,
  primary_domain_id: null,
  primary_hostname: null,
  backup_count: 0,
  selection_reason: "x",
  risk,
});

describe("continuityDisplay", () => {
  it("formats uptime ratios", () => {
    expect(formatUptime(null)).toBe("—");
    expect(formatUptime(1)).toBe("100%");
    expect(formatUptime(0.99999)).toBe("100%");
    expect(formatUptime(0.9876)).toBe("98.76%");
    expect(formatUptime(0)).toBe("0.00%");
    expect(formatUptime(Number.NaN)).toBe("—");
  });

  it("classifies uptime tone", () => {
    expect(uptimeTone(undefined)).toBe("none");
    expect(uptimeTone(1)).toBe("good");
    expect(uptimeTone(0.99)).toBe("warn");
    expect(uptimeTone(0.5)).toBe("bad");
  });

  it("lists only risky presells, most severe first", () => {
    const out = presellsAtRisk([
      presell("a", "ok"),
      presell("b", "on_backup"),
      presell("c", "no_domain"),
      presell("d", "primary_down"),
    ]);
    expect(out.map((p) => p.id)).toEqual(["c", "d", "b"]);
  });
});
