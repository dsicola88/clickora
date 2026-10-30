import { describe, expect, it } from "vitest";
import {
  explainTrafficTypeLabel,
  listUnreplacedClickIdMacros,
  resolveTrafficType,
} from "./networkClickId";

describe("explainTrafficTypeLabel (Ads sem ID)", () => {
  it("Pago com gclid real", () => {
    expect(
      explainTrafficTypeLabel({
        source: "google_ads",
        medium: "cpc",
        gclid: "EAIaIQobChMI_real",
      }),
    ).toMatch(/ID de clique real/);
  });

  it("macro literal {gclid} explica Construtor / auto-tagging", () => {
    const msg = explainTrafficTypeLabel({
      source: "google_ads",
      medium: "cpc",
      gclid: "{gclid}",
    });
    expect(resolveTrafficType({ source: "google_ads", medium: "cpc", gclid: "{gclid}" })).toBe(
      "paid_untracked",
    );
    expect(listUnreplacedClickIdMacros({ gclid: "{gclid}" })).toEqual(["gclid"]);
    expect(msg).toMatch(/Macro não substituída/);
    expect(msg).toMatch(/auto-tagging/i);
  });

  it("UTM sem ID + cloud Google → AdsBot/preview", () => {
    const msg = explainTrafficTypeLabel({
      source: "google_ads",
      medium: "cpc",
      utm_source: "google_ads",
      visitorKind: "datacenter",
    });
    expect(msg).toMatch(/AdsBot|preview|cloud/i);
    expect(msg).toMatch(/auto-tagging/i);
  });

  it("UTM Real AU sem gclid → checklist Final URL", () => {
    const msg = explainTrafficTypeLabel({
      source: "google_ads",
      medium: "cpc",
      visitorKind: "real",
    });
    expect(msg).toMatch(/auto-tagging ON/i);
    expect(msg).toMatch(/gclid=TesTER-123/);
  });
});
