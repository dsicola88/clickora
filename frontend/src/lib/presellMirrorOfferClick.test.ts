import { describe, expect, it } from "vitest";
import {
  bindMirrorOfferClickCapture,
  resolveMirrorClickDestination,
  tagMirrorOfferElementsInDocument,
} from "./presellMirrorOfferClick";

describe("presellMirrorOfferClick", () => {
  const track = "https://honestverdictguide.online/api/track/r/abc?to=mweb";

  it("marca #order-now", () => {
    const doc = new DOMParser().parseFromString(
      `<!doctype html><a class="x" href="#order-now"></a>`,
      "text/html",
    );
    tagMirrorOfferElementsInDocument(doc);
    const a = doc.querySelector("a")!;
    expect(a.getAttribute("data-clickora-offer")).toBe("1");
    expect(a.getAttribute("href")).toBe("#order-now");
  });

  it("resolve destino para data-clickora-offer + hash", () => {
    const a = document.createElement("a");
    a.href = "#order-now";
    a.setAttribute("data-clickora-offer", "1");
    expect(resolveMirrorClickDestination(a, track)).toBe(track);
  });

  it("bind captura clique em #order-now", () => {
    const doc = new DOMParser().parseFromString(
      `<!doctype html><body><a href="#order-now" class="btn">Order Now</a></body>`,
      "text/html",
    );
    const unbind = bindMirrorOfferClickCapture(doc, track);
    const a = doc.querySelector("a")!;
    let assigned = "";
    const prev = window.top?.location.assign;
    try {
      Object.defineProperty(window, "location", {
        value: { assign: (u: string) => { assigned = u; } },
        configurable: true,
      });
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    } finally {
      unbind();
      if (prev) Object.defineProperty(window, "location", { value: { assign: prev }, configurable: true });
    }
    expect(assigned).toBe(track);
  });
});
