import { describe, expect, it } from "vitest";
import { resolveClickVisitorQuality } from "./clickVisitorQuality";

describe("resolveClickVisitorQuality", () => {
  it("diz Real quando não há bot nem datacenter", () => {
    const q = resolveClickVisitorQuality({});
    expect(q.kind).toBe("real");
    expect(q.label).toBe("Real");
  });

  it("diz Bot pelo UA", () => {
    const q = resolveClickVisitorQuality({ is_bot: true, bot_label: "SEO/crawler" });
    expect(q.kind).toBe("bot");
    expect(q.label).toBe("Bot (SEO/crawler)");
  });

  it("diz Crawler Google para bots oficiais Google", () => {
    const q = resolveClickVisitorQuality({ is_bot: true, bot_label: "Google" });
    expect(q.label).toMatch(/Crawler Google/);
  });

  it("diz Datacenter com a rede", () => {
    const q = resolveClickVisitorQuality({
      unqualified: true,
      ip_network: "AWS",
      unqualified_reason: "Rede AWS (us-west-1).",
    });
    expect(q.kind).toBe("datacenter");
    expect(q.label).toBe("Datacenter (AWS)");
  });
});
