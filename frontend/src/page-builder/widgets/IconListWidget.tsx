import type { ComponentType } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";
import * as Icons from "lucide-react";

export interface IconListItem {
  id: string;
  iconName: string;
  title: string;
  description: string;
  href: string;
}

export function IconListWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Record<string, unknown>;
  const items = (Array.isArray(c.items) ? c.items : []) as IconListItem[];
  const iconSize = typeof c.iconSize === "number" ? c.iconSize : 22;
  const iconColor = (c.iconColor as string) ?? "#e63946";
  const gap = typeof c.gap === "number" ? c.gap : 16;
  const titleColor = (c.titleColor as string) ?? "#0f172a";
  const descColor = (c.descColor as string) ?? "#64748b";

  const outer = stylesToCss(widget.styles, device);

  if (!items.length) {
    return (
      <div style={outer}>
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          Adicione itens à lista no painel de propriedades.
        </p>
      </div>
    );
  }

  return (
    <div style={outer}>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap,
        }}
      >
        {items.map((item) => {
          const name = (item.iconName || "check").trim();
          const compName = name.charAt(0).toUpperCase() + name.slice(1);
          const IconComp =
            ((Icons as unknown as Record<string, ComponentType<{ size?: number; color?: string }>>)[compName] as
              | ComponentType<{ size?: number; color?: string }>
              | undefined) ?? Icons.Check;
          const href = (item.href || "").trim();
          const inner = (
            <>
              <span
                style={{
                  flexShrink: 0,
                  width: Math.max(40, iconSize + 20),
                  height: Math.max(40, iconSize + 20),
                  borderRadius: 12,
                  background: `${iconColor}14`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-hidden
              >
                <IconComp size={iconSize} color={iconColor} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 15,
                    fontWeight: 600,
                    color: titleColor,
                    marginBottom: item.description ? 4 : 0,
                    lineHeight: 1.35,
                  }}
                >
                  {item.title || "Item"}
                </span>
                {item.description ? (
                  <span
                    style={{ display: "block", fontSize: 14, lineHeight: 1.55, color: descColor }}
                    // eslint-disable-next-line react/no-danger -- author-controlled rich text
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                ) : null}
              </span>
            </>
          );

          return (
            <li key={item.id}>
              {href ? (
                <a
                  href={href.startsWith("http") || href.startsWith("/") || href.startsWith("#") ? href : `https://${href}`}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                    textDecoration: "none",
                    color: "inherit",
                    padding: "4px 0",
                    borderRadius: 8,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  {inner}
                </a>
              ) : (
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "4px 0" }}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
