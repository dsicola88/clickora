import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";
import { Star } from "lucide-react";
import { resolveLucideIconOr } from "../lucide-icon";

export function IconWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const name = (widget.content.name as string) ?? "star";
  const size = (widget.content.size as number) ?? 48;
  const href = ((widget.content.link as string) ?? "").trim();
  const shape = ((widget.content.shape as string) ?? "none") as "none" | "circle" | "square";
  const shapeBg = ((widget.content.shapeBg as string) ?? "#f1f5f9") as string;
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);
  const IconComp = resolveLucideIconOr(name, Star);

  const icon = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: shape === "none" ? undefined : size + 24,
        height: shape === "none" ? undefined : size + 24,
        borderRadius: shape === "circle" ? "50%" : shape === "square" ? 10 : 0,
        background: shape === "none" ? undefined : shapeBg,
      }}
    >
      <IconComp size={size} color={css.color as string | undefined} />
    </span>
  );

  return (
    <div style={{ display: "flex", justifyContent: alignToFlexJustify(align), ...css }}>
      {href ? (
        <a href={href} style={{ color: "inherit", textDecoration: "none", display: "inline-flex" }}>
          {icon}
        </a>
      ) : (
        icon
      )}
    </div>
  );
}
