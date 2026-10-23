import { describe, expect, it } from "vitest";
import { resolveClickVisitorQuality } from "./clickVisitorQuality";

describe("resolveClickVisitorQuality", () => {
  it("não chama «Real» — só Sem alerta", () => {
    const q = resolveClickVisitorQuality({});
    expect(q.kind).toBe("sem_alerta");
    expect(q.label).toBe("Sem alerta");
    expect(q.detail.toLowerCase()).toMatch(/não prova/);
  });

  it("Bot genérico pelo UA", () => {
    const q = resolveClickVisitorQuality({ is_bot: true, bot_label: "SEO/crawler" });
    expect(q.kind).toBe("bot");
    expect(q.label).toBe("Bot (SEO/crawler)");
  });

  it("Crawler Google explícito — não sugerir blacklist", () => {
    const q = resolveClickVisitorQuality({ is_bot: true, bot_label: "Google" });
    expect(q.label).toMatch(/Crawler Google/);
    expect(q.detail.toLowerCase()).toMatch(/não deve ir à blacklist/);
  });

  it("Datacenter com rede explícita", () => {
    const q = resolveClickVisitorQuality({
      unqualified: true,
      ip_network: "AWS",
      unqualified_reason: "Rede AWS (us-west-1).",
    });
    expect(q.kind).toBe("datacenter");
    expect(q.label).toBe("Datacenter (AWS)");
  });
});
