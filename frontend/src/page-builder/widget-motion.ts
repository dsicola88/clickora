/** Motion Effects nível Elementor Pro+ — aplicável a qualquer widget. */

import type { WidgetEffects } from "./types";

export type { WidgetEffects };

export const ENTRANCE_ANIMATION_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "fadeIn", label: "Fade In" },
  { value: "fadeInUp", label: "Fade In Up" },
  { value: "fadeInDown", label: "Fade In Down" },
  { value: "fadeInLeft", label: "Fade In Left" },
  { value: "fadeInRight", label: "Fade In Right" },
  { value: "zoomIn", label: "Zoom In" },
  { value: "zoomOut", label: "Zoom Out" },
  { value: "slideUp", label: "Slide Up" },
  { value: "slideDown", label: "Slide Down" },
  { value: "slideLeft", label: "Slide Left" },
  { value: "slideRight", label: "Slide Right" },
  { value: "bounceIn", label: "Bounce In" },
  { value: "bounceInUp", label: "Bounce In Up" },
  { value: "flipInX", label: "Flip In X" },
  { value: "flipInY", label: "Flip In Y" },
  { value: "rotateIn", label: "Rotate In" },
  { value: "rotateInDownLeft", label: "Rotate In Down Left" },
  { value: "lightSpeedIn", label: "Light Speed In" },
  { value: "rollIn", label: "Roll In" },
  { value: "jackInTheBox", label: "Jack In The Box" },
] as const;

export const ENTRANCE_TRIGGER_OPTIONS = [
  { value: "scroll", label: "Ao entrar no ecrã (scroll)" },
  { value: "load", label: "Ao carregar a página" },
] as const;

export const CONTINUOUS_ANIMATION_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "float", label: "Flutuar" },
  { value: "pulse", label: "Pulse" },
  { value: "spin", label: "Rodar" },
  { value: "shake", label: "Tremor suave" },
  { value: "glow", label: "Brilho" },
] as const;

export const SCROLLING_EFFECT_OPTIONS = [
  { value: "none", label: "Nenhum" },
  { value: "vertical", label: "Vertical" },
  { value: "horizontal", label: "Horizontal" },
  { value: "transparency", label: "Transparência" },
  { value: "blur", label: "Blur" },
  { value: "rotate", label: "Rodar" },
  { value: "scale", label: "Escala" },
] as const;

export const HOVER_PRESET_OPTIONS = [
  { value: "", label: "Nenhum (custom / vazio)" },
  { value: "scale(1.05)", label: "Crescer" },
  { value: "scale(0.95)", label: "Encolher" },
  { value: "translateY(-4px)", label: "Subir" },
  { value: "translateY(4px)", label: "Descer" },
  { value: "scale(1.05) translateY(-3px)", label: "Crescer + subir" },
  { value: "rotate(2deg)", label: "Rodar ligeiro" },
  { value: "rotate(-2deg) scale(1.03)", label: "Rodar + crescer" },
  { value: "translateY(-6px) scale(1.04)", label: "Levantar (card)" },
] as const;

export const EASING_PRESET_OPTIONS = [
  { value: "ease", label: "ease" },
  { value: "linear", label: "linear" },
  { value: "ease-in", label: "ease-in" },
  { value: "ease-out", label: "ease-out" },
  { value: "ease-in-out", label: "ease-in-out" },
  { value: "cubic-bezier(0.4, 0, 0.2, 1)", label: "Suave (Material)" },
  { value: "cubic-bezier(0.22, 1, 0.36, 1)", label: "Ease Out Expo" },
  { value: "cubic-bezier(0.68, -0.55, 0.265, 1.55)", label: "Elástico" },
  { value: "cubic-bezier(0.34, 1.56, 0.64, 1)", label: "Overshoot" },
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
    case "fadeInUp":
    case "slideUp":
      return {
        name: "fadeInUp",
        css: "from{opacity:0;transform:translate3d(0,36px,0)}to{opacity:1;transform:translate3d(0,0,0)}",
      };
    case "fadeInDown":
    case "slideDown":
      return {
        name: "fadeInDown",
        css: "from{opacity:0;transform:translate3d(0,-36px,0)}to{opacity:1;transform:translate3d(0,0,0)}",
      };
    case "fadeInLeft":
    case "slideLeft":
      return {
        name: "fadeInLeft",
        css: "from{opacity:0;transform:translate3d(40px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}",
      };
    case "fadeInRight":
    case "slideRight":
      return {
        name: "fadeInRight",
        css: "from{opacity:0;transform:translate3d(-40px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}",
      };
    case "zoomIn":
      return {
        name: "zoomIn",
        css: "from{opacity:0;transform:scale3d(0.88,0.88,1)}to{opacity:1;transform:scale3d(1,1,1)}",
      };
    case "zoomOut":
      return {
        name: "zoomOut",
        css: "from{opacity:0;transform:scale3d(1.18,1.18,1)}to{opacity:1;transform:scale3d(1,1,1)}",
      };
    case "bounceIn":
      return {
        name: "bounceIn",
        css:
          "0%{opacity:0;transform:scale3d(0.86,0.86,1)}45%{opacity:1;transform:scale3d(1.06,1.06,1)}70%{transform:scale3d(0.98,0.98,1)}100%{opacity:1;transform:scale3d(1,1,1)}",
      };
    case "bounceInUp":
      return {
        name: "bounceInUp",
        css:
          "0%{opacity:0;transform:translate3d(0,48px,0)}60%{opacity:1;transform:translate3d(0,-10px,0)}80%{transform:translate3d(0,4px,0)}100%{transform:translate3d(0,0,0)}",
      };
    case "flipInX":
      return {
        name: "flipInX",
        css:
          "from{opacity:0;transform:perspective(600px) rotateX(75deg)}to{opacity:1;transform:perspective(600px) rotateX(0)}",
      };
    case "flipInY":
      return {
        name: "flipInY",
        css:
          "from{opacity:0;transform:perspective(600px) rotateY(75deg)}to{opacity:1;transform:perspective(600px) rotateY(0)}",
      };
    case "rotateIn":
      return {
        name: "rotateIn",
        css: "from{opacity:0;transform:rotate(-180deg) scale(0.6)}to{opacity:1;transform:rotate(0) scale(1)}",
      };
    case "rotateInDownLeft":
      return {
        name: "rotateInDownLeft",
        css:
          "from{opacity:0;transform:rotate(-45deg);transform-origin:left bottom}to{opacity:1;transform:rotate(0);transform-origin:left bottom}",
      };
    case "lightSpeedIn":
      return {
        name: "lightSpeedIn",
        css:
          "from{opacity:0;transform:translate3d(80%,0,0) skewX(-24deg)}60%{opacity:1;transform:skewX(10deg)}80%{transform:skewX(-4deg)}to{transform:translate3d(0,0,0)}",
      };
    case "rollIn":
      return {
        name: "rollIn",
        css:
          "from{opacity:0;transform:translate3d(-80%,0,0) rotate(-120deg)}to{opacity:1;transform:translate3d(0,0,0) rotate(0)}",
      };
    case "jackInTheBox":
      return {
        name: "jackInTheBox",
        css:
          "from{opacity:0;transform:scale(0.1) rotate(30deg);transform-origin:center bottom}50%{transform:rotate(-10deg)}70%{transform:rotate(3deg)}to{opacity:1;transform:scale(1) rotate(0)}",
      };
    default:
      return null;
  }
}

function buildContinuousKeyframes(kind: string): { name: string; css: string } | null {
  switch (kind) {
    case "float":
      return {
        name: "float",
        css: "0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}",
      };
    case "pulse":
      return {
        name: "pulse",
        css: "0%,100%{transform:scale(1)}50%{transform:scale(1.04)}",
      };
    case "spin":
      return { name: "spin", css: "to{transform:rotate(360deg)}" };
    case "shake":
      return {
        name: "shake",
        css: "0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}",
      };
    case "glow":
      return {
        name: "glow",
        css: "0%,100%{filter:brightness(1)}50%{filter:brightness(1.12)}",
      };
    default:
      return null;
  }
}

function boolish(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function numish(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

export function resolveWidgetEffects(
  effects: WidgetEffects | undefined,
  content?: Record<string, unknown>,
): WidgetEffects {
  const c = content ?? {};
  const triggerRaw =
    effects?.entranceTrigger ??
    (typeof c.entranceTrigger === "string" ? c.entranceTrigger : undefined);
  return {
    entranceAnimation:
      effects?.entranceAnimation ??
      (typeof c.entranceAnimation === "string" ? c.entranceAnimation : undefined) ??
      "none",
    entranceDurationMs:
      effects?.entranceDurationMs ??
      (typeof c.entranceDurationMs === "number" ? c.entranceDurationMs : undefined) ??
      700,
    entranceDelayMs:
      effects?.entranceDelayMs ??
      (typeof c.entranceDelayMs === "number" ? c.entranceDelayMs : undefined) ??
      0,
    entranceEasing:
      effects?.entranceEasing ??
      (typeof c.entranceEasing === "string" ? c.entranceEasing : undefined) ??
      "cubic-bezier(0.22, 1, 0.36, 1)",
    entranceTrigger: triggerRaw === "load" ? "load" : "scroll",
    entranceOnce: boolish(effects?.entranceOnce ?? c.entranceOnce, true),
    entranceThreshold: numish(effects?.entranceThreshold ?? c.entranceThreshold, 12),
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
      280,
    transitionEasing:
      effects?.transitionEasing ??
      (typeof c.transitionEasing === "string" ? c.transitionEasing : undefined) ??
      "cubic-bezier(0.4, 0, 0.2, 1)",
    sticky: boolish(effects?.sticky ?? c.sticky, false),
    stickyOffsetPx: numish(effects?.stickyOffsetPx ?? c.stickyOffsetPx, 0),
    continuousAnimation:
      effects?.continuousAnimation ??
      (typeof c.continuousAnimation === "string" ? c.continuousAnimation : undefined) ??
      "none",
    continuousDurationMs: numish(effects?.continuousDurationMs ?? c.continuousDurationMs, 3000),
    scrollingEffect:
      effects?.scrollingEffect ??
      (typeof c.scrollingEffect === "string" ? c.scrollingEffect : undefined) ??
      "none",
    scrollingSpeed: numish(effects?.scrollingSpeed ?? c.scrollingSpeed, 40),
    scrollingReverse: boolish(effects?.scrollingReverse ?? c.scrollingReverse, false),
    mouseTilt: boolish(effects?.mouseTilt ?? c.mouseTilt, false),
    mouseTiltMaxDeg: numish(effects?.mouseTiltMaxDeg ?? c.mouseTiltMaxDeg, 8),
    mouseTrack: boolish(effects?.mouseTrack ?? c.mouseTrack, false),
    mouseTrackPx: numish(effects?.mouseTrackPx ?? c.mouseTrackPx, 12),
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
  const duration = Math.max(0, e.transitionDurationMs ?? 280);
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
  const entDur = Math.max(0, e.entranceDurationMs ?? 700);
  const entDelay = Math.max(0, e.entranceDelayMs ?? 0);
  const entEase = (e.entranceEasing || "cubic-bezier(0.22, 1, 0.36, 1)").trim();
  const trigger = e.entranceTrigger === "load" ? "load" : "scroll";

  const cont = (e.continuousAnimation || "none").trim();
  const keyCont = buildContinuousKeyframes(cont);
  const contDur = Math.max(400, e.continuousDurationMs ?? 3000);

  const needsPerspective = Boolean(e.mouseTilt || e.mouseTrack);
  const needsScrollFx = (e.scrollingEffect || "none") !== "none";

  let css = `.${cls}{transition:transform ${duration}ms ${easing},box-shadow ${duration}ms ${easing},opacity ${duration}ms ${easing},color ${duration}ms ${easing},background ${duration}ms ${easing},border-color ${duration}ms ${easing},filter ${duration}ms ${easing}`;
  if (transform) css += `;transform:${transform}`;
  if (needsPerspective) css += `;transform-style:preserve-3d;will-change:transform`;
  if (needsScrollFx) css += `;will-change:transform,opacity,filter`;
  css += `}`;

  if (e.sticky) {
    const top = Math.max(0, e.stickyOffsetPx ?? 0);
    css += `.${cls}{position:sticky;top:${top}px;z-index:20}`;
  }

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
    css += `@keyframes ${kf}{${keyEnt.css}}`;
    const anim = `animation:${kf} ${entDur}ms ${entEase} ${entDelay}ms both`;
    if (trigger === "load") {
      css += `.${cls}{${anim}}`;
    } else {
      css += `.${cls}.pb-ent-scroll:not(.pb-in-view){opacity:0;visibility:hidden}`;
      css += `.${cls}.pb-ent-scroll.pb-in-view{visibility:visible;${anim}}`;
      css += `@media (prefers-reduced-motion:reduce){.${cls}.pb-ent-scroll:not(.pb-in-view){opacity:1;visibility:visible}.${cls}.pb-ent-scroll.pb-in-view{animation:none}}`;
    }
  }

  if (keyCont && cont !== "none") {
    const kf = `pb_loop_${sid}_${keyCont.name}`;
    css += `@keyframes ${kf}{${keyCont.css}}`;
    css += `.${cls}.pb-loop{animation:${kf} ${contDur}ms ease-in-out infinite}`;
    css += `@media (prefers-reduced-motion:reduce){.${cls}.pb-loop{animation:none}}`;
  }

  if (needsPerspective || needsScrollFx) {
    css += `.${cls}.pb-fx{transform:translate3d(var(--pb-tx,0px),var(--pb-ty,0px),0) rotateX(var(--pb-rx,0deg)) rotateY(var(--pb-ry,0deg)) scale(var(--pb-sc,1)) rotate(var(--pb-rot,0deg));opacity:var(--pb-op,1);filter:blur(var(--pb-bl,0px))}`;
  }

  return css;
}

export function widgetHasMotion(
  effects: WidgetEffects | undefined,
  content?: Record<string, unknown>,
): boolean {
  const e = resolveWidgetEffects(effects, content);
  const entrance = (e.entranceAnimation || "none").trim();
  const cont = (e.continuousAnimation || "none").trim();
  const scrollFx = (e.scrollingEffect || "none").trim();
  return Boolean(
    (entrance && entrance !== "none") ||
      (cont && cont !== "none") ||
      (scrollFx && scrollFx !== "none") ||
      e.sticky ||
      e.mouseTilt ||
      e.mouseTrack ||
      e.transform?.trim() ||
      e.hoverTransform?.trim() ||
      e.hoverBoxShadow?.trim() ||
      e.hoverColor?.trim() ||
      e.hoverBackground?.trim() ||
      e.hoverBorderColor?.trim() ||
      (typeof e.hoverOpacity === "number" && !Number.isNaN(e.hoverOpacity)),
  );
}

export function widgetNeedsMotionRuntime(
  effects: WidgetEffects | undefined,
  content?: Record<string, unknown>,
): boolean {
  const e = resolveWidgetEffects(effects, content);
  const entrance = (e.entranceAnimation || "none").trim();
  const scrollEntrance = entrance !== "none" && e.entranceTrigger !== "load";
  const cont = (e.continuousAnimation || "none").trim();
  const scrollFx = (e.scrollingEffect || "none").trim();
  return Boolean(
    scrollEntrance ||
      (cont && cont !== "none") ||
      (scrollFx && scrollFx !== "none") ||
      e.mouseTilt ||
      e.mouseTrack,
  );
}
