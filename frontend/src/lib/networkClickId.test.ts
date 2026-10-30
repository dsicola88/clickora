import { describe, expect, it } from "vitest";
import {
  explainTrafficTypeLabel,
  listUnreplacedClickIdMacros,
  resolveTrafficType,
} from "./networkClickId";

describe("explainTrafficTypeLabel (Sem ID do clique)", () => {
  it("Pago com ID real", () => {
    expect(
      explainTrafficTypeLabel({
        source: "google_ads",
        medium: "cpc",
        gclid: "EAIaIQobChMI_real",
      }),
    ).toMatch(/ID completo/i);
  });

  it("macro literal explica não abrir no browser", () => {
    const msg = explainTrafficTypeLabel({
      source: "google_ads",
      medium: "cpc",
      gclid: "{gclid}",
    });
    expect(resolveTrafficType({ source: "google_ads", medium: "cpc", gclid: "{gclid}" })).toBe(
      "paid_untracked",
    );
    expect(listUnreplacedClickIdMacros({ gclid: "{gclid}" })).toEqual(["gclid"]);
    expect(msg).toMatch(/não abras/i);
    expect(msg).toMatch(/anúncio real/i);
  });

  it("campanha + cloud → não é comprador", () => {
    const msg = explainTrafficTypeLabel({
      source: "google_ads",
      medium: "cpc",
      utm_source: "google_ads",
      visitorKind: "datacenter",
    });
    expect(msg).toMatch(/não é um comprador/i);
  });

  it("campanha real sem ID → Codificação automática", () => {
    const msg = explainTrafficTypeLabel({
      source: "google_ads",
      medium: "cpc",
      visitorKind: "real",
    });
    expect(msg).toMatch(/Codificação automática/i);
  });
});
