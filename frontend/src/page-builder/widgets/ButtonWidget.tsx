import type { ComponentType, CSSProperties } from "react";
import * as Icons from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";
import { useInlineEdit } from "../inline-edit";

function resolveLucideIcon(name: string): ComponentType<{ size?: number; color?: string; style?: CSSProperties }> | null {
  const raw = name.trim();
  if (!raw) return null;
  const pascal = raw.includes("-")
    ? raw
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("")
    : raw.charAt(0).toUpperCase() + raw.slice(1);
  const Comp = (Icons as unknown as Record<string, ComponentType<{ size?: number; color?: string; style?: CSSProperties }>>)[
    pascal
  ];
  return Comp ?? null;
}

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
  const commit = useInlineEdit();
  const rawHref = String(c.href ?? "").trim();
  const placeholderHref = !rawHref || rawHref === "#" || rawHref.startsWith("#");
  const openBlank = c.target === "_blank";
  const iconName = String(c.iconName ?? "").trim();
  const iconPosition = (c.iconPosition as string) === "left" ? "left" : "right";
  const iconSize =
    typeof c.iconSize === "number" && c.iconSize > 0
      ? c.iconSize
      : Math.max(14, Math.round(((widget.styles.typography?.desktop?.fontSize as number) || 16) * 0.95));
  const IconComp = resolveLucideIcon(iconName);
  const rowStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };

  return (
    <div style={{ display: "flex", justifyContent: alignToFlexJustify(align) }}>
      <div
        className={hasEntrance ? `lovBtn_wrap_${sid}` : undefined}
        style={{ display: "inline-block" }}
      >
        {injectedCss ? <style dangerouslySetInnerHTML={{ __html: injectedCss }} /> : null}
        {commit ? (
          <button
            type="button"
            className={`lovBtn_${sid}`}
            style={{ ...btnStyle, ...rowStyle }}
            onClick={(e) => e.preventDefault()}
          >
            {IconComp && iconPosition === "left" ? <IconComp size={iconSize} aria-hidden /> : null}
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => {
                const next = e.currentTarget.textContent ?? "";
                if (next !== text) commit({ text: next });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            >
              {text}
            </span>
            {IconComp && iconPosition === "right" ? <IconComp size={iconSize} aria-hidden /> : null}
          </button>
        ) : (
          <a
            href={placeholderHref ? "#" : rawHref}
            target={openBlank ? "_blank" : undefined}
            rel={openBlank ? "noopener noreferrer" : undefined}
            data-clickora-offer={placeholderHref ? "1" : undefined}
            className={`lovBtn_${sid}`}
            style={{ ...btnStyle, ...rowStyle, textDecoration: "none" }}
          >
            {IconComp && iconPosition === "left" ? <IconComp size={iconSize} aria-hidden /> : null}
            <span>{text}</span>
            {IconComp && iconPosition === "right" ? <IconComp size={iconSize} aria-hidden /> : null}
          </a>
        )}
      </div>
    </div>
  );
}
