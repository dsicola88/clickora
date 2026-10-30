/** Posições / modos / animações partilhados por popups e banners (cookies). */

import type { CSSProperties } from "react";

export type OverlayPosition =
  | "center"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right";

export type OverlayDisplayMode = "modal" | "bar" | "slide-in" | "toast";

export type OverlayAnimation =
  | "none"
  | "fade"
  | "fadeUp"
  | "fadeDown"
  | "scale"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown";

export const OVERLAY_POSITION_OPTIONS: Array<{ value: OverlayPosition; label: string }> = [
  { value: "center", label: "Centro" },
  { value: "top", label: "Topo (barra)" },
  { value: "bottom", label: "Fundo (barra)" },
  { value: "top-left", label: "Canto superior esquerdo" },
  { value: "top-right", label: "Canto superior direito" },
  { value: "bottom-left", label: "Canto inferior esquerdo" },
  { value: "bottom-right", label: "Canto inferior direito" },
  { value: "left", label: "Lateral esquerda" },
  { value: "right", label: "Lateral direita" },
];

export const OVERLAY_MODE_OPTIONS: Array<{ value: OverlayDisplayMode; label: string }> = [
  { value: "modal", label: "Modal (centro / foco)" },
  { value: "bar", label: "Barra (largura total)" },
  { value: "slide-in", label: "Painel lateral / canto" },
  { value: "toast", label: "Toast compacto" },
];

export const OVERLAY_ANIMATION_OPTIONS: Array<{ value: OverlayAnimation; label: string }> = [
  { value: "none", label: "Nenhuma" },
  { value: "fade", label: "Fade" },
  { value: "fadeUp", label: "Fade + subir" },
  { value: "fadeDown", label: "Fade + descer" },
  { value: "scale", label: "Escala" },
  { value: "slideLeft", label: "Deslizar da esquerda" },
  { value: "slideRight", label: "Deslizar da direita" },
  { value: "slideUp", label: "Deslizar de baixo" },
  { value: "slideDown", label: "Deslizar de cima" },
];

const ANIM_FROM: Record<Exclude<OverlayAnimation, "none">, string> = {
  fade: "opacity:0",
  fadeUp: "opacity:0; transform:translateY(16px)",
  fadeDown: "opacity:0; transform:translateY(-16px)",
  scale: "opacity:0; transform:scale(0.92)",
  slideLeft: "opacity:0; transform:translateX(-28px)",
  slideRight: "opacity:0; transform:translateX(28px)",
  slideUp: "opacity:0; transform:translateY(28px)",
  slideDown: "opacity:0; transform:translateY(-28px)",
};

/** CSS keyframes + animation shorthand para o cartão. */
export function buildOverlayEntranceAnimation(
  animation: OverlayAnimation | undefined,
  durationMs = 320,
  easing = "cubic-bezier(0.22, 1, 0.36, 1)",
): { keyframes: string; animation: string } | null {
  const kind = animation && animation !== "none" ? animation : null;
  if (!kind) return null;
  const dur = Math.max(80, Math.min(3000, durationMs || 320));
  const ease = easing?.trim() || "cubic-bezier(0.22, 1, 0.36, 1)";
  const name = `ckora_ovl_${kind}`;
  const from = ANIM_FROM[kind];
  return {
    keyframes: `@keyframes ${name}{from{${from}}to{opacity:1;transform:none}}`,
    animation: `${name} ${dur}ms ${ease} both`,
  };
}

export function resolveOverlayDisplayMode(
  raw: unknown,
  fallback: OverlayDisplayMode = "modal",
): OverlayDisplayMode {
  if (raw === "modal" || raw === "bar" || raw === "slide-in" || raw === "toast") return raw;
  return fallback;
}

export function resolveOverlayPosition(
  raw: unknown,
  fallback: OverlayPosition = "center",
): OverlayPosition {
  const ok = OVERLAY_POSITION_OPTIONS.some((o) => o.value === raw);
  return ok ? (raw as OverlayPosition) : fallback;
}

/**
 * Estilo do contentor fixed que posiciona o cartão.
 * `bar` força top/bottom full-bleed; cantos usam inset.
 */
export function overlayHostStyle(args: {
  mode: OverlayDisplayMode;
  position: OverlayPosition;
  offsetXPx?: number;
  offsetYPx?: number;
  zIndex?: number;
  backdrop?: boolean;
  backdropColor?: string;
}): CSSProperties {
  const ox = Math.max(0, args.offsetXPx ?? 16);
  const oy = Math.max(0, args.offsetYPx ?? 16);
  const z = args.zIndex ?? 99990;
  const mode = args.mode;
  let position = args.position;

  if (mode === "modal") position = "center";
  if (mode === "bar" && position !== "top" && position !== "bottom") {
    position = position.startsWith("top") ? "top" : "bottom";
  }
  if (mode === "toast" && (position === "center" || position === "left" || position === "right" || position === "top" || position === "bottom")) {
    position = "bottom-right";
  }

  const base: CSSProperties = {
    position: "fixed",
    zIndex: z,
    pointerEvents: "none",
  };

  if (position === "center") {
    return {
      ...base,
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: Math.max(ox, oy),
      pointerEvents: "auto",
      background: args.backdrop ? args.backdropColor || "rgba(15, 23, 42, 0.55)" : "transparent",
    };
  }

  if (position === "top" || position === "bottom") {
    return {
      ...base,
      left: 0,
      right: 0,
      ...(position === "top" ? { top: 0 } : { bottom: 0 }),
      display: "flex",
      justifyContent: "center",
      padding: mode === "bar" ? 0 : oy,
      pointerEvents: "auto",
    };
  }

  if (position === "left" || position === "right") {
    return {
      ...base,
      top: 0,
      bottom: 0,
      ...(position === "left" ? { left: 0 } : { right: 0 }),
      display: "flex",
      alignItems: "stretch",
      justifyContent: position === "left" ? "flex-start" : "flex-end",
      pointerEvents: "auto",
    };
  }

  const style: CSSProperties = { ...base, display: "flex", pointerEvents: "auto" };
  if (position.includes("top")) style.top = oy;
  if (position.includes("bottom")) style.bottom = oy;
  if (position.includes("left")) style.left = ox;
  if (position.includes("right")) style.right = ox;
  return style;
}

export function overlayCardWidthStyle(args: {
  mode: OverlayDisplayMode;
  position: OverlayPosition;
  maxWidthPx?: number;
}): CSSProperties {
  const maxW = Math.min(960, Math.max(240, args.maxWidthPx ?? 480));
  if (args.mode === "bar" || args.position === "top" || args.position === "bottom") {
    return { width: "100%", maxWidth: "100%", borderRadius: args.mode === "bar" ? 0 : 12 };
  }
  if (args.position === "left" || args.position === "right" || args.mode === "slide-in") {
    return { width: `min(92vw, ${Math.min(maxW, 420)}px)`, maxWidth: "92vw", height: "100%" };
  }
  if (args.mode === "toast") {
    return { width: `min(92vw, ${Math.min(maxW, 360)}px)` };
  }
  return { width: `min(92vw, ${maxW}px)` };
}
