import type { WidgetInteraction, WidgetNode } from "./types";
import { requestOpenPopup } from "./page-popups";

function resolveTargetEl(targetId: string | undefined): HTMLElement | null {
  const id = (targetId ?? "").trim().replace(/^#/, "");
  if (!id || typeof document === "undefined") return null;
  return document.getElementById(id);
}

export function runWidgetInteraction(ix: WidgetInteraction): void {
  switch (ix.action) {
    case "openUrl": {
      const url = (ix.url ?? "").trim();
      if (!url) return;
      if (ix.openInNewTab) window.open(url, "_blank", "noopener,noreferrer");
      else window.location.assign(url);
      return;
    }
    case "scrollTo": {
      const el = resolveTargetEl(ix.targetId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    case "openPopup": {
      const id = (ix.targetId ?? "").trim();
      if (id) requestOpenPopup(id);
      return;
    }
    case "show": {
      const el = resolveTargetEl(ix.targetId);
      if (el) {
        el.style.display = "";
        el.hidden = false;
        el.setAttribute("data-pb-hidden", "0");
      }
      return;
    }
    case "hide": {
      const el = resolveTargetEl(ix.targetId);
      if (el) {
        el.style.display = "none";
        el.setAttribute("data-pb-hidden", "1");
      }
      return;
    }
    case "toggle": {
      const el = resolveTargetEl(ix.targetId);
      if (!el) return;
      const hidden = el.getAttribute("data-pb-hidden") === "1" || el.style.display === "none";
      if (hidden) {
        el.style.display = "";
        el.setAttribute("data-pb-hidden", "0");
      } else {
        el.style.display = "none";
        el.setAttribute("data-pb-hidden", "1");
      }
      return;
    }
    default:
      return;
  }
}

export function widgetHasInteractions(widget: WidgetNode): boolean {
  return Array.isArray(widget.interactions) && widget.interactions.length > 0;
}

export function interactionsForTrigger(
  widget: WidgetNode,
  trigger: WidgetInteraction["trigger"],
): WidgetInteraction[] {
  return (widget.interactions ?? []).filter((ix) => ix.trigger === trigger);
}
