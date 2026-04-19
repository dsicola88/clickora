import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";

export interface TickerContent {
  items: string[];
  speed: number;
  direction: "left" | "right";
  separator: string;
  fontSize: number;
  color: string;
  bg: string;
  paddingY: number;
  gap: number;
}

export function TickerWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<TickerContent>;
  const items = c.items ?? ["Oferta limitada", "Envio seguro", "Garantia incluída"];
  const speed = c.speed ?? 25;
  const direction = c.direction ?? "left";
  const separator = c.separator ?? "•";
  const fontSize = c.fontSize ?? 16;
  const color = c.color ?? "#0f172a";
  const bg = c.bg ?? "transparent";
  const paddingY = c.paddingY ?? 12;
  const gap = c.gap ?? 40;

  const cls = `lov-ticker-${widget.id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const animName = `${cls}-anim`;
  const css = `
@keyframes ${animName}{from{transform:translateX(${direction === "left" ? "0" : "-50%"})}to{transform:translateX(${direction === "left" ? "-50%" : "0"})}}
.${cls}{display:flex;overflow:hidden;background:${bg};padding:${paddingY}px 0;width:100%}
.${cls} > div{display:flex;flex-shrink:0;animation:${animName} ${speed}s linear infinite;gap:${gap}px;padding-right:${gap}px}
.${cls} span{color:${color};font-size:${fontSize}px;font-weight:500;white-space:nowrap;display:inline-flex;align-items:center;gap:${gap}px}
`;

  const doubled = [...items, ...items];

  return (
    <div style={stylesToCssWidgetContent(widget.styles, device)}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className={cls}>
        <div>
          {doubled.map((item, i) => (
            <span key={`${item}-${i}`}>
              {item}
              <span style={{ opacity: 0.4 }}>{separator}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
