/** Motion Effects estilo Elementor — aplicável a qualquer widget. */

import type { WidgetEffects } from "./types";

export type { WidgetEffects };

export const ENTRANCE_ANIMATION_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "fadeIn", label: "Fade In" },
  { value: "zoomIn", label: "Zoom In" },
  { value: "slideUp", label: "Slide Up" },
  { value: "slideDown", label: "Slide Down" },
  { value: "slideLeft", label: "Slide Left" },
  { value: "slideRight", label: "Slide Right" },
  { value: "bounceIn", label: "Bounce In" },
] as const;

export const HOVER_PRESET_OPTIONS = [
  { value: "", label: "Nenhum (custom / vazio)" },
  { value: "scale(1.05)", label: "Crescer" },
  { value: "scale(0.95)", label: "Encolher" },
  { value: "translateY(-4px)", label: "Subir" },
  { value: "translateY(4px)", label: "Descer" },
  { value: "scale(1.05) translateY(-3px)", label: "Crescer + subir" },
  { value: "rotate(2deg)", label: "Rodar ligeiro" },
] as const;

export const EASING_PRESET_OPTIONS = [
  { value: "ease", label: "ease" },
  { value: "linear", label: "linear" },
  { value: "ease-in", label: "ease-in" },
  { value: "ease-out", label: "ease-out" },
  { value: "ease-in-out", label: "ease-in-out" },
  { value: "cubic-bezier(0.4, 0, 0.2, 1)", label: "Suave (Material)" },
  { value: "cubic-bezier(0.68, -0.55, 0.265, 1.55)", label: "Elástico" },
] as const;

export function sanitizeMotionId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
}

export function motionClassName(widgetId: string): string {
  return `pb-m_${sanitizeMotionId(widgetId)}`;
}

export function buildEntranceKeyframes(kind: string): { name: string; css: string } | null {
  switch (kind) {
    case "fadeIn":
      return { name: "fadeIn", css: "from{opacity:0}to{opacity:1}" };
    case "zoomIn":
      return {
        name: "zoomIn",
        css: "from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}",
      };
    case "slideUp":
      return {
        name: "slideUp",
        css: "from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}",
      };
    case "slideDown":
      return {
        name: "slideDown",
        css: "from{opacity:0;transform:translateY(-28px)}to{opacity:1;transform:translateY(0)}",
      };
    case "slideLeft":
      return {
        name: "slideLeft",
        css: "from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}",
      };
    case "slideRight":
      return {
        name: "slideRight",
        css: "from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)}",
      };
    case "bounceIn":
      return {
        name: "bounceIn",
        css:
          "0%{opacity:0;transform:scale(0.88)}45%{opacity:1;transform:scale(1.06)}70%{transform:scale(0.98)}100%{opacity:1;transform:scale(1)}",
      };
    default:
      return null;
  }
}

/**
 * Resolve efeitos do nó + fallback do content do botão (compat docs antigos).
 */
export function resolveWidgetEffects(
  effects: WidgetEffects | undefined,
  content?: Record<string, unknown>,
): WidgetEffects {
  const c = content ?? {};
  return {
    entranceAnimation:
      effects?.entranceAnimation ??
      (typeof c.entranceAnimation === "string" ? c.entranceAnimation : undefined) ??
      "none",
    entranceDurationMs:
      effects?.entranceDurationMs ??
      (typeof c.entranceDurationMs === "number" ? c.entranceDurationMs : undefined) ??
      600,
    entranceDelayMs:
      effects?.entranceDelayMs ??
      (typeof c.entranceDelayMs === "number" ? c.entranceDelayMs : undefined) ??
      0,
    entranceEasing:
      effects?.entranceEasing ??
      (typeof c.entranceEasing === "string" ? c.entranceEasing : undefined) ??
      "cubic-bezier(0.4, 0, 0.2, 1)",
    transform:
      effects?.transform ?? (typeof c.transform === "string" ? c.transform : undefined),
    hoverTransform:
      effects?.hoverTransform ??
      (typeof c.hoverTransform === "string" ? c.hoverTransform : undefined),
    hoverBoxShadow:
      effects?.hoverBoxShadow ??
      (typeof c.hoverBoxShadow === "string" ? c.hoverBoxShadow : undefined),
    hoverOpacity: effects?.hoverOpacity,
    hoverColor:
      effects?.hoverColor ?? (typeof c.hoverColor === "string" ? c.hoverColor : undefined),
    hoverBackground:
      effects?.hoverBackground ??
      (typeof c.hoverBackground === "string" ? c.hoverBackground : undefined),
    hoverBorderColor:
      effects?.hoverBorderColor ??
      (typeof c.hoverBorderColor === "string" ? c.hoverBorderColor : undefined),
    transitionDurationMs:
      effects?.transitionDurationMs ??
      (typeof c.transitionDurationMs === "number" ? c.transitionDurationMs : undefined) ??
      200,
    transitionEasing:
      effects?.transitionEasing ??
      (typeof c.transitionEasing === "string" ? c.transitionEasing : undefined) ??
      "ease",
  };
}

export function buildWidgetMotionCss(
  widgetId: string,
  effects: WidgetEffects | undefined,
  content?: Record<string, unknown>,
): string {
  const e = resolveWidgetEffects(effects, content);
  const cls = motionClassName(widgetId);
  const sid = sanitizeMotionId(widgetId);
  const duration = Math.max(0, e.transitionDurationMs ?? 200);
  const easing = (e.transitionEasing || "ease").trim() || "ease";
  const transform = e.transform?.trim();
  const hoverTransform = e.hoverTransform?.trim();
  const hoverBoxShadow = e.hoverBoxShadow?.trim();
  const hoverOpacity =
    typeof e.hoverOpacity === "number" && !Number.isNaN(e.hoverOpacity)
      ? Math.min(1, Math.max(0, e.hoverOpacity))
      : undefined;

  const entrance = (e.entranceAnimation || "none").trim();
  const keyEnt = buildEntranceKeyframes(entrance);
  const entDur = Math.max(0, e.entranceDurationMs ?? 600);
  const entDelay = Math.max(0, e.entranceDelayMs ?? 0);
  const entEase = (e.entranceEasing || "cubic-bezier(0.4, 0, 0.2, 1)").trim();

  let css = `.${cls}{transition:transform ${duration}ms ${easing},box-shadow ${duration}ms ${easing},opacity ${duration}ms ${easing},color ${duration}ms ${easing},background ${duration}ms ${easing},border-color ${duration}ms ${easing}`;
  if (transform) css += `;transform:${transform}`;
  css += `}`;

  const hoverColor = e.hoverColor?.trim();
  const hoverBackground = e.hoverBackground?.trim();
  const hoverBorderColor = e.hoverBorderColor?.trim();

  const hoverRules: string[] = [];
  if (hoverTransform) hoverRules.push(`transform:${hoverTransform}`);
  if (hoverBoxShadow) hoverRules.push(`box-shadow:${hoverBoxShadow}`);
  if (hoverOpacity !== undefined) hoverRules.push(`opacity:${hoverOpacity}`);
  if (hoverColor) hoverRules.push(`color:${hoverColor}`);
  if (hoverBackground) hoverRules.push(`background:${hoverBackground}`);
  if (hoverBorderColor) hoverRules.push(`border-color:${hoverBorderColor}`);
  if (hoverRules.length) css += `.${cls}:hover{${hoverRules.join(";")}}`;

  if (keyEnt && entrance !== "none") {
    const kf = `pb_ent_${sid}_${keyEnt.name}`;
    css += `@keyframes ${kf}{${keyEnt.css}}.${cls}{animation:${kf} ${entDur}ms ${entEase} ${entDelay}ms both}`;
  }

  return css;
}

export function widgetHasMotion(
  effects: WidgetEffects | undefined,
  content?: Record<string, unknown>,
): boolean {
  const e = resolveWidgetEffects(effects, content);
  const entrance = (e.entranceAnimation || "none").trim();
  return Boolean(
    (entrance && entrance !== "none") ||
      e.transform?.trim() ||
      e.hoverTransform?.trim() ||
      e.hoverBoxShadow?.trim() ||
      e.hoverColor?.trim() ||
      e.hoverBackground?.trim() ||
      e.hoverBorderColor?.trim() ||
      (typeof e.hoverOpacity === "number" && !Number.isNaN(e.hoverOpacity)),
  );
}
