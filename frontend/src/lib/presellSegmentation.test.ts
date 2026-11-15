import { describe, expect, it } from "vitest";
import {
  isSegmentationPresellType,
  resolveSegmentationCopy,
  resolveSegmentationDestination,
} from "./presellSegmentation";

describe("presellSegmentation", () => {
  it("detecta o tipo", () => {
    expect(isSegmentationPresellType("segmentacao")).toBe(true);
    expect(isSegmentationPresellType("Segmentacao")).toBe(true);
    expect(isSegmentationPresellType("cookies")).toBe(false);
  });

  it("usa defaults EN e aceita overrides", () => {
    const d = resolveSegmentationCopy({}, "en");
    expect(d.title).toMatch(/see first/i);
    expect(d.reviewLabel).toMatch(/review/i);
    expect(d.officialLabel).toMatch(/official/i);
    expect(d.allowClose).toBe(true);

    const o = resolveSegmentationCopy(
      {
        segmentationTitle: "Escolha",
        segmentationReviewLabel: "Review",
        segmentationOfficialLabel: "Oficial",
        segmentationReviewUrl: "https://review.example/",
        segmentationOfferUrl: "https://offer.example/",
        segmentationAllowClose: false,
      },
      "pt-BR",
    );
    expect(o.title).toBe("Escolha");
    expect(o.reviewUrl).toBe("https://review.example/");
    expect(o.officialUrl).toBe("https://offer.example/");
    expect(o.allowClose).toBe(false);
  });

  it("resolve destinos com fallback ao hoplink", () => {
    const copy = resolveSegmentationCopy(
      { segmentationReviewUrl: "https://review.example/x" },
      "en",
    );
    const r = resolveSegmentationDestination("review", copy, "https://offer.example/");
    expect(r.dest).toBe("https://review.example/x");
    expect(r.segParam).toBe("review");
    const o = resolveSegmentationDestination("official", copy, "https://offer.example/");
    expect(o.dest).toBe("https://offer.example/");
    expect(o.segParam).toBe("official");
  });
});
