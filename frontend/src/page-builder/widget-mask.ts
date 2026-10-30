import type { CSSProperties } from "react";
import type { WidgetNode } from "./types";

export const CSS_MASK_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "circle", label: "Círculo" },
  { value: "ellipse", label: "Elipse" },
  { value: "diamond", label: "Losango" },
  { value: "hexagon", label: "Hexágono" },
  { value: "blob", label: "Blob" },
  { value: "custom", label: "Custom (clip-path)" },
] as const;

const PRESETS: Record<string, string> = {
  circle: "circle(50% at 50% 50%)",
  ellipse: "ellipse(45% 40% at 50% 50%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  hexagon: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  blob: "polygon(40% 0%, 70% 5%, 95% 35%, 90% 70%, 60% 100%, 25% 95%, 5% 65%, 10% 25%)",
};

export function resolveWidgetClipPath(widget: WidgetNode): string | undefined {
  const mask = (widget.cssMask || "none").trim();
  if (!mask || mask === "none") return undefined;
  if (mask === "custom") {
    const custom = (widget.cssMaskCustom || "").trim();
    return custom || undefined;
  }
  return PRESETS[mask];
}

export function widgetMaskStyle(widget: WidgetNode): CSSProperties | undefined {
  const clip = resolveWidgetClipPath(widget);
  if (!clip) return undefined;
  return { clipPath: clip, WebkitClipPath: clip };
}
