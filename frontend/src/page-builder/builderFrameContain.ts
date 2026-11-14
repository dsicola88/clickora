import type { DeviceType } from "./types";

/**
 * Largura fluida relativa ao frame do dispositivo no editor
 * (evita 92vw da janela → tablet «mais largo» que desktop).
 */
export function builderContainedWidthPx(
  widthPx: number,
  opts?: { inBuilder?: boolean; device?: DeviceType; mobileCap?: number; tabletCap?: number },
): string {
  const w = Math.max(120, Math.round(widthPx));
  const mobileCap = opts?.mobileCap ?? 280;
  const tabletCap = opts?.tabletCap ?? Math.min(w, 300);
  let capped = w;
  if (opts?.device === "mobile") capped = Math.min(w, mobileCap);
  else if (opts?.device === "tablet") capped = Math.min(w, tabletCap);
  const fluid = opts?.inBuilder ? "100%" : "92vw";
  return `min(${fluid}, ${capped}px)`;
}
