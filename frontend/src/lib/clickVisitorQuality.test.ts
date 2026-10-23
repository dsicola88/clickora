import { describe, expect, it } from "vitest";
import { resolveClickVisitorQuality } from "./clickVisitorQuality";

describe("resolveClickVisitorQuality", () => {
  it("marca Real quando não há bot nem datacenter", () => {
    const q = resolveClickVisitorQuality({});
    expect(q.kind).toBe("real");
    expect(q.label).toBe("Real");
  });

  it("marca Bot pelo User-Agent", () => {
    const q = resolveClickVisitorQuality({ is_bot: true, bot_label: "Google" });
    expect(q.kind).toBe("bot");
    expect(q.label).toBe("Bot (Google)");
  });

  it("Datacenter tem prioridade sobre bot e mostra a rede", () => {
    const q = resolveClickVisitorQuality({
      is_bot: true,
      bot_label: "Google",
      unqualified: true,
      ip_network: "AWS",
      unqualified_reason: "Rede AWS (us-west-1).",
    });
    expect(q.kind).toBe("datacenter");
    expect(q.label).toBe("Datacenter (AWS)");
    expect(q.detail).toContain("AWS");
  });
});
