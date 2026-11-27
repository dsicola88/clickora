import { describe, expect, it } from "vitest";
import { interactionAllowedForTrigger, interactionsForTrigger } from "./widget-interactions";
import type { WidgetNode } from "./types";

function widgetWith(interactions: WidgetNode["interactions"]): WidgetNode {
  return { id: "w1", type: "text", content: {}, styles: {}, interactions } as unknown as WidgetNode;
}

describe("widget interactions — navegação só com clique", () => {
  it("openUrl só é permitido no clique", () => {
    expect(interactionAllowedForTrigger("openUrl", "click")).toBe(true);
    expect(interactionAllowedForTrigger("openUrl", "hover")).toBe(false);
    expect(interactionAllowedForTrigger("show", "hover")).toBe(true);
    expect(interactionAllowedForTrigger("openPopup", "hover")).toBe(true);
  });

  it("documentos antigos com hover → openUrl não navegam", () => {
    const w = widgetWith([
      { id: "a", trigger: "hover", action: "openUrl", url: "https://example.com" },
      { id: "b", trigger: "hover", action: "show", targetId: "x" },
      { id: "c", trigger: "click", action: "openUrl", url: "https://example.com" },
    ]);
    expect(interactionsForTrigger(w, "hover").map((ix) => ix.id)).toEqual(["b"]);
    expect(interactionsForTrigger(w, "click").map((ix) => ix.id)).toEqual(["c"]);
  });
});
