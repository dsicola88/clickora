import { describe, expect, it } from "vitest";
import { builderContainedWidthPx } from "./builderFrameContain";
import { overlayCardWidthStyle, overlayHostStyle } from "./overlay-placement";

describe("builderFrameContain", () => {
  it("no builder usa 100% em vez de 92vw", () => {
    expect(builderContainedWidthPx(320, { inBuilder: true })).toBe("min(100%, 320px)");
    expect(builderContainedWidthPx(320, { inBuilder: false })).toBe("min(92vw, 320px)");
  });

  it("cap mobile/tablet evita overlay maior que o frame", () => {
    expect(
      builderContainedWidthPx(400, { inBuilder: true, device: "mobile", mobileCap: 280 }),
    ).toBe("min(100%, 280px)");
    expect(
      builderContainedWidthPx(400, { inBuilder: true, device: "tablet", tabletCap: 300 }),
    ).toBe("min(100%, 300px)");
  });
});

describe("overlay containToParent", () => {
  it("host absolute no builder", () => {
    const s = overlayHostStyle({
      mode: "modal",
      position: "center",
      containToParent: true,
    });
    expect(s.position).toBe("absolute");
  });

  it("cartão modal usa 100% no builder", () => {
    const w = overlayCardWidthStyle({
      mode: "modal",
      position: "center",
      maxWidthPx: 480,
      containToParent: true,
    });
    expect(w.width).toBe("min(100%, 480px)");
    expect(w.maxWidth).toBe("100%");
  });
});
