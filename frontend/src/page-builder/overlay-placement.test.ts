import { describe, expect, it } from "vitest";
import {
  buildOverlayEntranceAnimation,
  overlayCardWidthStyle,
  overlayHostStyle,
  resolveOverlayDisplayMode,
  resolveOverlayPosition,
} from "./overlay-placement";

describe("overlay-placement", () => {
  it("resolve mode e posição com fallbacks", () => {
    expect(resolveOverlayDisplayMode("bar")).toBe("bar");
    expect(resolveOverlayDisplayMode("nope")).toBe("modal");
    expect(resolveOverlayPosition("bottom-left")).toBe("bottom-left");
    expect(resolveOverlayPosition("x")).toBe("center");
  });

  it("host modal centra com backdrop", () => {
    const s = overlayHostStyle({
      mode: "modal",
      position: "center",
      backdrop: true,
      backdropColor: "rgba(0,0,0,0.5)",
    });
    expect(s.inset).toBe(0);
    expect(s.display).toBe("flex");
    expect(s.background).toContain("rgba");
  });

  it("host canto usa top/right offsets", () => {
    const s = overlayHostStyle({
      mode: "toast",
      position: "top-right",
      offsetXPx: 12,
      offsetYPx: 18,
    });
    expect(s.top).toBe(18);
    expect(s.right).toBe(12);
  });

  it("barra full-bleed no topo/fundo", () => {
    const top = overlayHostStyle({ mode: "bar", position: "top" });
    expect(top.left).toBe(0);
    expect(top.right).toBe(0);
    expect(top.top).toBe(0);
    const w = overlayCardWidthStyle({ mode: "bar", position: "bottom", maxWidthPx: 480 });
    expect(w.width).toBe("100%");
  });

  it("gera animação de entrada", () => {
    const a = buildOverlayEntranceAnimation("fadeUp", 300);
    expect(a).not.toBeNull();
    expect(a!.keyframes).toContain("@keyframes");
    expect(a!.animation).toContain("300ms");
    expect(buildOverlayEntranceAnimation("none")).toBeNull();
  });
});
