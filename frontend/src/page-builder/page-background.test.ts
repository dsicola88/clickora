import { describe, expect, it } from "vitest";
import {
  inferPageBackgroundType,
  resolvePageBackgroundStyle,
  serializePageBackground,
} from "./page-background";

describe("page-background", () => {
  it("infers type from legacy CSS", () => {
    expect(inferPageBackgroundType("#fff")).toBe("solid");
    expect(inferPageBackgroundType("linear-gradient(90deg, #000, #fff)")).toBe("gradient");
    expect(inferPageBackgroundType('url("https://x/a.jpg") center / cover')).toBe("image");
  });

  it("resolves solid and gradient styles", () => {
    expect(resolvePageBackgroundStyle({ backgroundType: "solid", backgroundSolid: "#112233" })).toEqual({
      background: "#112233",
    });
    expect(
      resolvePageBackgroundStyle({
        backgroundType: "gradient",
        backgroundGradient: "linear-gradient(180deg, #000, #fff)",
      }),
    ).toEqual({ background: "linear-gradient(180deg, #000, #fff)" });
  });

  it("resolves image with fallback color", () => {
    const style = resolvePageBackgroundStyle({
      backgroundType: "image",
      backgroundSolid: "#010101",
      backgroundImageUrl: "https://cdn.example/bg.webp",
      backgroundImageSize: "cover",
      backgroundImagePosition: "center top",
    });
    expect(style.backgroundColor).toBe("#010101");
    expect(style.backgroundImage).toBe('url("https://cdn.example/bg.webp")');
    expect(style.backgroundSize).toBe("cover");
    expect(style.backgroundPosition).toBe("center top");
  });

  it("serializes for legacy background field", () => {
    expect(serializePageBackground({ type: "solid", solid: "#abc" })).toBe("#abc");
    expect(
      serializePageBackground({
        type: "gradient",
        gradient: "linear-gradient(#000,#fff)",
      }),
    ).toBe("linear-gradient(#000,#fff)");
    expect(
      serializePageBackground({
        type: "image",
        solid: "#fff",
        imageUrl: "https://x/y.png",
      }),
    ).toContain('url("https://x/y.png")');
  });
});
