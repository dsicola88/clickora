import { useEffect, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface OnepageNavItem {
  id: string;
  label: string;
  targetId: string; // section id without "#"
}

export interface OnepageNavContent {
  items: OnepageNavItem[];
  position: "fixed-right" | "fixed-left" | "inline";
  activeColor: string;
  inactiveColor: string;
  showLabels: boolean;
}

export function OnepageNavWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<OnepageNavContent>;
  const items = c.items ?? [];
  const position = c.position ?? "fixed-right";
  const activeColor = c.activeColor ?? "#e63946";
  const inactiveColor = c.inactiveColor ?? "#cbd5e1";
  const showLabels = c.showLabels ?? true;
  const [active, setActive] = useState(items[0]?.targetId ?? "");

  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) return;
    const onScroll = () => {
      let current = items[0]?.targetId ?? "";
      for (const it of items) {
        const el = document.getElementById(it.targetId);
        if (el && el.getBoundingClientRect().top <= 120) {
          current = it.targetId;
        }
      }
      setActive(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  if (items.length === 0) {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Adicione âncoras no painel de propriedades.
        </p>
      </div>
    );
  }

  const isFixed = position !== "inline";
  const containerStyle: React.CSSProperties = isFixed
    ? {
        position: "fixed",
        top: "50%",
        transform: "translateY(-50%)",
        [position === "fixed-right" ? "right" : "left"]: 24,
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }
    : { display: "flex", gap: 16, alignItems: "center" };

  return (
    <nav style={isFixed ? undefined : stylesToCss(widget.styles, device)}>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          ...containerStyle,
        }}
      >
        {items.map((it) => {
          const isActive = active === it.targetId;
          return (
            <li key={it.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <a
                href={`#${it.targetId}`}
                aria-label={it.label}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(it.targetId)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                style={{
                  width: isActive ? 14 : 10,
                  height: isActive ? 14 : 10,
                  borderRadius: "50%",
                  background: isActive ? activeColor : inactiveColor,
                  display: "block",
                  transition: "all 0.2s",
                  textDecoration: "none",
                }}
              />
              {showLabels && (
                <span
                  style={{
                    fontSize: 13,
                    color: isActive ? activeColor : inactiveColor,
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    document
                      .getElementById(it.targetId)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  {it.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
