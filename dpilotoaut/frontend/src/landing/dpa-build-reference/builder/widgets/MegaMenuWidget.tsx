import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface MegaMenuColumn {
  id: string;
  title: string;
  items: Array<{ id: string; label: string; href: string; description?: string }>;
}

export interface MegaMenuContent {
  triggerLabel: string;
  columns: MegaMenuColumn[];
  ctaTitle: string;
  ctaDescription: string;
  ctaButtonText: string;
  ctaButtonHref: string;
  panelBg: string;
  textColor: string;
  accentColor: string;
}

export function MegaMenuWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<MegaMenuContent>;
  const trigger = c.triggerLabel ?? "Produtos";
  const columns = c.columns ?? [];
  const panelBg = c.panelBg ?? "#ffffff";
  const textColor = c.textColor ?? "#1f2937";
  const accentColor = c.accentColor ?? "#e63946";
  const [open, setOpen] = useState(false);

  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: "relative", display: "inline-block", ...stylesToCss(widget.styles, device) }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          background: "transparent",
          border: "none",
          color: textColor,
          fontSize: 15,
          fontWeight: 500,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "8px 0",
        }}
      >
        {trigger}
        <ChevronDown
          size={16}
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        />
      </button>
      {open && columns.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            background: panelBg,
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            display: "grid",
            gridTemplateColumns: device === "mobile" ? "1fr" : `repeat(${columns.length}, minmax(180px, 1fr)) ${c.ctaTitle ? "240px" : ""}`,
            gap: 24,
            minWidth: device === "mobile" ? 280 : 600,
            zIndex: 50,
          }}
        >
          {columns.map((col) => (
            <div key={col.id}>
              <h4
                style={{
                  margin: "0 0 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: accentColor,
                }}
              >
                {col.title}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {col.items.map((it) => (
                  <li key={it.id}>
                    <a
                      href={it.href || "#"}
                      style={{
                        color: textColor,
                        textDecoration: "none",
                        fontSize: 14,
                        fontWeight: 500,
                        display: "block",
                      }}
                    >
                      {it.label}
                      {it.description && (
                        <div style={{ fontSize: 12, opacity: 0.65, fontWeight: 400, marginTop: 2 }}>
                          {it.description}
                        </div>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {c.ctaTitle && (
            <div
              style={{
                background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                padding: 20,
                borderRadius: 8,
                color: "#fff",
              }}
            >
              <h4 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>{c.ctaTitle}</h4>
              <p style={{ margin: "0 0 14px", fontSize: 13, lineHeight: 1.5, opacity: 0.95 }}>
                {c.ctaDescription}
              </p>
              {c.ctaButtonText && (
                <a
                  href={c.ctaButtonHref || "#"}
                  style={{
                    display: "inline-block",
                    background: "#fff",
                    color: accentColor,
                    padding: "8px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {c.ctaButtonText}
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
