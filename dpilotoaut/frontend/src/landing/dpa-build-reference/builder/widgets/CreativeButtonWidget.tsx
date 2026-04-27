import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export interface CreativeButtonContent {
  text: string;
  href: string;
  target: "_self" | "_blank";
  effect: "slide" | "fill" | "shine" | "border" | "lift" | "glow";
  bg: string;
  color: string;
  hoverBg: string;
  hoverColor: string;
  borderRadius: number;
  paddingY: number;
  paddingX: number;
  fontSize: number;
  fontWeight: number;
}

export function CreativeButtonWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<CreativeButtonContent>;
  const text = c.text ?? "Clique aqui";
  const href = c.href ?? "#";
  const target = c.target ?? "_self";
  const effect = c.effect ?? "slide";
  const bg = c.bg ?? "#e63946";
  const color = c.color ?? "#ffffff";
  const hoverBg = c.hoverBg ?? "#0f172a";
  const hoverColor = c.hoverColor ?? "#ffffff";
  const borderRadius = c.borderRadius ?? 8;
  const paddingY = c.paddingY ?? 14;
  const paddingX = c.paddingX ?? 28;
  const fontSize = c.fontSize ?? 16;
  const fontWeight = c.fontWeight ?? 600;
  const align = resolveResponsive(widget.styles.align, device);

  const cls = `lov-btn-${widget.id.replace(/[^a-zA-Z0-9]/g, "")}`;

  const css = `
.${cls}{position:relative;display:inline-flex;align-items:center;justify-content:center;padding:${paddingY}px ${paddingX}px;font-size:${fontSize}px;font-weight:${fontWeight};border-radius:${borderRadius}px;border:2px solid ${bg};background:${bg};color:${color};text-decoration:none;cursor:pointer;overflow:hidden;transition:all .35s ease;z-index:1}
.${cls}::before{content:"";position:absolute;inset:0;background:${hoverBg};transition:transform .4s ease;z-index:-1}
.${cls}:hover{color:${hoverColor};border-color:${hoverBg}}
${effect === "slide" ? `.${cls}::before{transform:translateX(-100%)}.${cls}:hover::before{transform:translateX(0)}` : ""}
${effect === "fill" ? `.${cls}::before{transform:scaleY(0);transform-origin:top}.${cls}:hover::before{transform:scaleY(1)}` : ""}
${effect === "shine" ? `.${cls}::before{display:none}.${cls}::after{content:"";position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(120deg,transparent,rgba(255,255,255,.45),transparent);transition:left .6s ease}.${cls}:hover::after{left:120%}.${cls}:hover{background:${hoverBg};color:${hoverColor}}` : ""}
${effect === "border" ? `.${cls}{background:transparent;color:${bg}}.${cls}::before{display:none}.${cls}:hover{background:${bg};color:${color}}` : ""}
${effect === "lift" ? `.${cls}::before{display:none}.${cls}:hover{transform:translateY(-3px);box-shadow:0 10px 25px rgba(0,0,0,.18);background:${hoverBg};color:${hoverColor}}` : ""}
${effect === "glow" ? `.${cls}::before{display:none}.${cls}:hover{background:${hoverBg};color:${hoverColor};box-shadow:0 0 0 4px ${bg}33,0 0 30px ${bg}66}` : ""}
`;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        ...stylesToCss(widget.styles, device),
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <a
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={cls}
      >
        {text}
      </a>
    </div>
  );
}
