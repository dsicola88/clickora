/**
 * Contrato E2E: payload da API analytics → etiqueta Situação.
 */
import { describe, expect, it } from "vitest";
import { resolveClickVisitorQuality } from "./clickVisitorQuality";

describe("E2E API → Situação UI", () => {
  it("Cloud (AWS) a partir da API", () => {
    const q = resolveClickVisitorQuality({
      is_bot: false,
      unqualified: true,
      ip_network: "AWS",
      unqualified_reason: "Rede AWS (us-west-1, evidência bootstrap_confirmed).",
    });
    expect(q.label).toBe("Cloud (AWS)");
    expect(q.kind).toBe("datacenter");
  });

  it("Real a partir da API limpa", () => {
    const q = resolveClickVisitorQuality({
      is_bot: false,
      unqualified: false,
      ip_network: null,
    });
    expect(q.label).toBe("Real");
    expect(q.kind).toBe("real");
  });

  it("Robot a partir da API", () => {
    const q = resolveClickVisitorQuality({
      is_bot: true,
      bot_label: "SEO/crawler",
      unqualified: false,
    });
    expect(q.label).toBe("Robot (SEO/crawler)");
  });

  it("UI não inventa Cloud sem unqualified", () => {
    const q = resolveClickVisitorQuality({
      is_bot: false,
      unqualified: false,
      ip_network: "AWS",
    });
    expect(q.label).toBe("Real");
  });

  it("Cloud ganha a Robot se a API mandar os dois", () => {
    const q = resolveClickVisitorQuality({
      is_bot: true,
      bot_label: "Google",
      unqualified: true,
      ip_network: "AWS",
    });
    expect(q.label).toBe("Cloud (AWS)");
  });
});
