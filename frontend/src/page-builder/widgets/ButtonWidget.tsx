import type { CSSProperties } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

function sanitizeClassId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
}

function buildEntranceKeyframes(kind: string): { name: string; css: string } | null {
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

export function ButtonWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Record<string, unknown>;
  const text = (c.text as string) ?? "Botão";
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);
  const sid = sanitizeClassId(widget.id);

  const hoverColor = (c.hoverColor as string | undefined)?.trim();
  const hoverBackground = (c.hoverBackground as string | undefined)?.trim();
  const hoverBorderColor = (c.hoverBorderColor as string | undefined)?.trim();
  const hoverBoxShadow = (c.hoverBoxShadow as string | undefined)?.trim();
  const hoverTransform = (c.hoverTransform as string | undefined)?.trim();
  const transform = (c.transform as string | undefined)?.trim();
  const transitionDurationMs =
    typeof c.transitionDurationMs === "number" && c.transitionDurationMs >= 0
      ? c.transitionDurationMs
      : 200;
  const transitionEasing = ((c.transitionEasing as string) ?? "ease").trim() || "ease";

  const entranceAnimation = ((c.entranceAnimation as string) ?? "none").trim();
  const entranceDurationMs =
    typeof c.entranceDurationMs === "number" && c.entranceDurationMs >= 0 ? c.entranceDurationMs : 600;
  const entranceDelayMs =
    typeof c.entranceDelayMs === "number" && c.entranceDelayMs >= 0 ? c.entranceDelayMs : 0;
  const entranceEasing =
    ((c.entranceEasing as string) ?? "cubic-bezier(0.4, 0, 0.2, 1)").trim() ||
    "cubic-bezier(0.4, 0, 0.2, 1)";

  const transitionProps = `color ${transitionDurationMs}ms ${transitionEasing}, background ${transitionDurationMs}ms ${transitionEasing}, border-color ${transitionDurationMs}ms ${transitionEasing}, box-shadow ${transitionDurationMs}ms ${transitionEasing}, transform ${transitionDurationMs}ms ${transitionEasing}`;

  const btnStyle: CSSProperties = {
    ...css,
    cursor: "pointer",
    border: css.border ?? "none",
    transition: transitionProps,
    ...(transform ? { transform } : {}),
  };

  const hoverRules: string[] = [];
  if (hoverColor) hoverRules.push(`color:${hoverColor} !important`);
  if (hoverBackground) hoverRules.push(`background:${hoverBackground} !important`);
  if (hoverBorderColor) hoverRules.push(`border-color:${hoverBorderColor} !important`);
  if (hoverBoxShadow) hoverRules.push(`box-shadow:${hoverBoxShadow} !important`);
  if (hoverTransform) hoverRules.push(`transform:${hoverTransform} !important`);

  const keyEnt = buildEntranceKeyframes(entranceAnimation);
  const kfName = `lovBtn_${sid}_${keyEnt?.name ?? "x"}`;

  let injectedCss = "";
  if (hoverRules.length > 0) {
    injectedCss += `.lovBtn_${sid}:hover{${hoverRules.join(";")}}`;
  }
  if (keyEnt && entranceAnimation !== "none") {
    injectedCss += `@keyframes ${kfName}{${keyEnt.css}}.lovBtn_wrap_${sid}{animation:${kfName} ${entranceDurationMs}ms ${entranceEasing} ${entranceDelayMs}ms both}`;
  }

  const hasEntrance = Boolean(keyEnt && entranceAnimation !== "none");

  return (
    <div style={{ display: "flex", justifyContent: alignToFlexJustify(align) }}>
      <div
        className={hasEntrance ? `lovBtn_wrap_${sid}` : undefined}
        style={{ display: "inline-block" }}
      >
        {injectedCss ? <style dangerouslySetInnerHTML={{ __html: injectedCss }} /> : null}
        <button type="button" className={`lovBtn_${sid}`} style={btnStyle} onClick={(e) => e.preventDefault()}>
          {text}
        </button>
      </div>
    </div>
  );
}
