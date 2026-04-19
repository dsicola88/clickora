import { useEffect, useRef, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";

export interface ProgressBarItem {
  id: string;
  label: string;
  value: number; // 0-100
  color?: string;
}

export interface ProgressTrackerContent {
  items: ProgressBarItem[];
  variant: "bar" | "circle";
  showPercent: boolean;
  animate: boolean;
  trackColor: string;
  fillColor: string;
  labelColor: string;
  height: number;
  gap: number;
  borderRadius: number;
}

export function ProgressTrackerWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<ProgressTrackerContent>;
  const items = c.items ?? [
    { id: "1", label: "Design", value: 90 },
    { id: "2", label: "Desenvolvimento", value: 75 },
    { id: "3", label: "Marketing", value: 60 },
  ];
  const variant = c.variant ?? "bar";
  const showPercent = c.showPercent ?? true;
  const animate = c.animate ?? true;
  const trackColor = c.trackColor ?? "#e5e7eb";
  const fillColor = c.fillColor ?? "#e63946";
  const labelColor = c.labelColor ?? "#1a1a1a";
  const height = c.height ?? 10;
  const gap = c.gap ?? 20;
  const borderRadius = c.borderRadius ?? 999;

  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!animate);

  useEffect(() => {
    if (!animate || !ref.current || visible) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [animate, visible]);

  return (
    <div ref={ref} style={stylesToCssWidgetContent(widget.styles, device)}>
      {variant === "bar" ? (
        <div style={{ display: "flex", flexDirection: "column", gap }}>
          {items.map((it) => {
            const pct = Math.max(0, Math.min(100, it.value));
            const color = it.color || fillColor;
            return (
              <div key={it.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: labelColor,
                  }}
                >
                  <span>{it.label}</span>
                  {showPercent && <span style={{ opacity: 0.7 }}>{pct}%</span>}
                </div>
                <div
                  style={{
                    background: trackColor,
                    height,
                    borderRadius,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: color,
                      height: "100%",
                      width: visible ? `${pct}%` : "0%",
                      borderRadius,
                      transition: "width 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: gap * 1.5,
          }}
        >
          {items.map((it) => {
            const pct = Math.max(0, Math.min(100, it.value));
            const color = it.color || fillColor;
            const size = 120;
            const stroke = 10;
            const radius = (size - stroke) / 2;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (visible ? (pct / 100) * circumference : circumference);
            return (
              <div
                key={it.id}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
              >
                <div style={{ position: "relative", width: size, height: size }}>
                  <svg
                    width={size}
                    height={size}
                    style={{ transform: "rotate(-90deg)" }}
                    aria-hidden="true"
                  >
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={trackColor}
                      strokeWidth={stroke}
                    />
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={color}
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.2,0.8,0.2,1)" }}
                    />
                  </svg>
                  {showPercent && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        fontWeight: 700,
                        color: labelColor,
                      }}
                    >
                      {pct}%
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: labelColor }}>
                  {it.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
