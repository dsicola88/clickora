import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface OffCanvasItem {
  id: string;
  label: string;
  href: string;
}

export interface OffCanvasContent {
  triggerLabel: string;
  triggerIcon: boolean;
  items: OffCanvasItem[];
  side: "left" | "right";
  width: number;
  bg: string;
  textColor: string;
  triggerBg: string;
  triggerColor: string;
  overlayColor: string;
}

export function OffCanvasWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<OffCanvasContent>;
  const items = c.items ?? [];
  const side = c.side ?? "right";
  const width = c.width ?? 320;
  const bg = c.bg ?? "#0f172a";
  const textColor = c.textColor ?? "#ffffff";
  const triggerBg = c.triggerBg ?? "transparent";
  const triggerColor = c.triggerColor ?? "#0f172a";
  const overlayColor = c.overlayColor ?? "rgba(0,0,0,0.5)";
  const [open, setOpen] = useState(false);

  return (
    <div style={stylesToCss(widget.styles, device)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{
          background: triggerBg,
          color: triggerColor,
          border: "none",
          padding: "10px 16px",
          borderRadius: 6,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 15,
          fontWeight: 500,
        }}
      >
        {c.triggerIcon !== false && <Menu size={20} />}
        {c.triggerLabel ?? "Menu"}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: overlayColor,
              zIndex: 9998,
              animation: "lov-fade-in 0.25s ease",
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              [side]: 0,
              bottom: 0,
              width,
              maxWidth: "85vw",
              background: bg,
              color: textColor,
              padding: 28,
              zIndex: 9999,
              boxShadow:
                side === "right" ? "-12px 0 30px rgba(0,0,0,.2)" : "12px 0 30px rgba(0,0,0,.2)",
              overflowY: "auto",
              animation: `lov-slide-${side === "right" ? "left" : "right"} 0.3s ease`,
            }}
          >
            <button
              type="button"
              aria-label="Fechar"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "transparent",
                border: "none",
                color: textColor,
                cursor: "pointer",
                padding: 6,
              }}
            >
              <X size={22} />
            </button>
            <nav style={{ marginTop: 32 }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {items.map((it) => (
                  <li key={it.id}>
                    <a
                      href={it.href || "#"}
                      onClick={() => setOpen(false)}
                      style={{
                        display: "block",
                        padding: "12px 0",
                        color: textColor,
                        textDecoration: "none",
                        fontSize: 17,
                        fontWeight: 500,
                        borderBottom: `1px solid ${textColor}22`,
                      }}
                    >
                      {it.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </>
      )}
    </div>
  );
}
