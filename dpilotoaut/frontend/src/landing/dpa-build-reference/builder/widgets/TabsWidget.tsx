import { useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface TabItem {
  id: string;
  title: string;
  content: string; // HTML
}

export interface TabsContent {
  items: TabItem[];
  orientation: "horizontal" | "vertical";
  activeColor: string;
  inactiveColor: string;
  bg: string;
  contentBg: string;
  contentColor: string;
  borderRadius: number;
}

export function TabsWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<TabsContent>;
  const items = c.items ?? [];
  const orientation = c.orientation ?? "horizontal";
  const activeColor = c.activeColor ?? "#e63946";
  const inactiveColor = c.inactiveColor ?? "#6b7280";
  const bg = c.bg ?? "#f9fafb";
  const contentBg = c.contentBg ?? "#ffffff";
  const contentColor = c.contentColor ?? "#1f2937";
  const borderRadius = c.borderRadius ?? 8;
  const [active, setActive] = useState(0);

  if (items.length === 0) {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Adicione abas no painel de propriedades.
        </p>
      </div>
    );
  }

  const isVertical = orientation === "vertical" && device !== "mobile";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isVertical ? "row" : "column",
        gap: 0,
        borderRadius,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        ...stylesToCss(widget.styles, device),
      }}
    >
      <div
        role="tablist"
        style={{
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          background: bg,
          flexShrink: 0,
          minWidth: isVertical ? 200 : undefined,
        }}
      >
        {items.map((item, i) => {
          const isActive = i === active;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActive(i);
              }}
              style={{
                flex: isVertical ? "0 0 auto" : 1,
                padding: "14px 18px",
                background: isActive ? contentBg : "transparent",
                border: "none",
                borderBottom: !isVertical && isActive ? `3px solid ${activeColor}` : "3px solid transparent",
                borderRight: isVertical && isActive ? `3px solid ${activeColor}` : "3px solid transparent",
                color: isActive ? activeColor : inactiveColor,
                fontWeight: isActive ? 600 : 500,
                fontSize: 14,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              {item.title}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        style={{
          padding: 20,
          background: contentBg,
          color: contentColor,
          flex: 1,
          fontSize: 14,
          lineHeight: 1.6,
        }}
        dangerouslySetInnerHTML={{ __html: items[active]?.content ?? "" }}
      />
    </div>
  );
}
