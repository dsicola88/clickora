import { describe, expect, it } from "vitest";
import { resolveMirrorAnchorNavigateHref } from "./presellMirrorIframeNav";

function a(href: string, text: string) {
  const el = document.createElement("a");
  el.setAttribute("href", href);
  el.textContent = text;
  return el;
}

describe("resolveMirrorAnchorNavigateHref", () => {
  const track =
    "https://honestverdictguide.online/api/track/r/abc?to=https%3A%2F%2Fmwebkivo.com%2F8389%2F5494%2F7%2F";

  it("navega CTAs com /track/ na janela principal", () => {
    const el = a(track, "Order Now");
    expect(resolveMirrorAnchorNavigateHref(el, track)).toBe(track);
  });

  it("CTA com # leva ao hoplink rastreado", () => {
    const el = a("#order", "ORDER NOW");
    expect(resolveMirrorAnchorNavigateHref(el, track)).toBe(track);
  });

  it("ignora links legais", () => {
    const el = a("/privacy", "Privacy Policy");
    expect(resolveMirrorAnchorNavigateHref(el, track)).toBeNull();
  });

  it("buygoods cru usa track offer", () => {
    const el = a("https://www.buygoods.com/secure/checkout?x=1", "Buy Now");
    expect(resolveMirrorAnchorNavigateHref(el, track)).toBe(track);
  });
});
