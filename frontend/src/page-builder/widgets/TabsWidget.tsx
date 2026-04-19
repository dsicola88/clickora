import { useState, useId } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface TabItem {
  id: string;
  label: string;
  html: string;
}

export function TabsWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Record<string, unknown>;
  const tabs = (Array.isArray(c.tabs) ? c.tabs : []) as TabItem[];
  const tabBg = (c.tabBg as string) ?? "#f1f5f9";
  const tabActiveBg = (c.tabActiveBg as string) ?? "#ffffff";
  const tabTextColor = (c.tabTextColor as string) ?? "#64748b";
  const tabActiveTextColor = (c.tabActiveTextColor as string) ?? "#0f172a";
  const accentColor = (c.accentColor as string) ?? "#e63946";
  const panelBg = (c.panelBg as string) ?? "#ffffff";
  const panelTextColor = (c.panelTextColor as string) ?? "#334155";
  const borderColor = (c.borderColor as string) ?? "#e2e8f0";
  const borderRadius = typeof c.borderRadius === "number" ? c.borderRadius : 12;

  const baseId = useId().replace(/:/g, "");
  const [active, setActive] = useState(0);
  const safeIndex = tabs.length ? Math.min(active, tabs.length - 1) : 0;
  const current = tabs[safeIndex];

  const outer = stylesToCss(widget.styles, device);

  if (!tabs.length) {
    return (
      <div style={outer}>
        <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
          Adicione separadores no painel de propriedades.
        </p>
      </div>
    );
  }

  const isMobile = device === "mobile";

  return (
    <div style={outer}>
      <div
        style={{
          borderRadius,
          border: `1px solid ${borderColor}`,
          overflow: "hidden",
          background: panelBg,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          role="tablist"
          aria-label="Separadores de conteúdo"
          style={{
            display: "flex",
            flexWrap: isMobile ? "nowrap" : "wrap",
            overflowX: isMobile ? "auto" : "visible",
            WebkitOverflowScrolling: "touch",
            gap: 0,
            background: tabBg,
            borderBottom: `1px solid ${borderColor}`,
          }}
        >
          {tabs.map((tab, i) => {
            const selected = i === safeIndex;
            const tabId = `${baseId}-tab-${tab.id}`;
            const panelId = `${baseId}-panel-${tab.id}`;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={tabId}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                style={{
                  flex: isMobile ? "0 0 auto" : "1 1 auto",
                  minWidth: isMobile ? "auto" : 0,
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  border: "none",
                  borderBottom: selected ? `2px solid ${accentColor}` : "2px solid transparent",
                  marginBottom: selected ? -1 : 0,
                  background: selected ? tabActiveBg : "transparent",
                  color: selected ? tabActiveTextColor : tabTextColor,
                  cursor: "pointer",
                  transition: "background 0.15s ease, color 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label || `Separador ${i + 1}`}
              </button>
            );
          })}
        </div>
        <div
          role="tabpanel"
          id={`${baseId}-panel-${current?.id}`}
          aria-labelledby={`${baseId}-tab-${current?.id}`}
          style={{
            padding: "18px 20px 20px",
            background: panelBg,
            color: panelTextColor,
            fontSize: 15,
            lineHeight: 1.65,
          }}
        >
          {current?.html ? (
            <div
              dangerouslySetInnerHTML={{ __html: current.html }}
            />
          ) : (
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>Sem conteúdo neste separador.</p>
          )}
        </div>
      </div>
    </div>
  );
}
