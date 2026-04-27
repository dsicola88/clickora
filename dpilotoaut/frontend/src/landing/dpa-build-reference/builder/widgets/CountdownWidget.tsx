import { useEffect, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface CountdownContent {
  /** ISO date string for the deadline. */
  deadline: string;
  showLabels: boolean;
  showDays: boolean;
  expiredMessage: string;
  digitBg: string;
  digitColor: string;
  labelColor: string;
  separatorColor: string;
  digitSize: number;
}

function diffParts(targetMs: number) {
  const now = Date.now();
  const diff = Math.max(0, targetMs - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, expired: diff === 0 };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function CountdownWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<CountdownContent>;
  const deadline = c.deadline ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const showLabels = c.showLabels ?? true;
  const showDays = c.showDays ?? true;
  const expiredMessage = c.expiredMessage ?? "A oferta expirou!";
  const digitBg = c.digitBg ?? "#0f172a";
  const digitColor = c.digitColor ?? "#ffffff";
  const labelColor = c.labelColor ?? "#475569";
  const separatorColor = c.separatorColor ?? "#0f172a";
  const digitSize = c.digitSize ?? 48;

  const target = new Date(deadline).getTime();
  const [parts, setParts] = useState(() => diffParts(target));

  useEffect(() => {
    setParts(diffParts(target));
    const t = setInterval(() => setParts(diffParts(target)), 1000);
    return () => clearInterval(t);
  }, [target]);

  if (parts.expired) {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <div
          style={{
            textAlign: "center",
            padding: "20px 16px",
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          {expiredMessage}
        </div>
      </div>
    );
  }

  const units: Array<{ value: number; label: string; show: boolean }> = [
    { value: parts.days, label: "Dias", show: showDays },
    { value: parts.hours, label: "Horas", show: true },
    { value: parts.minutes, label: "Min", show: true },
    { value: parts.seconds, label: "Seg", show: true },
  ];

  const visible = units.filter((u) => u.show);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        ...stylesToCss(widget.styles, device),
      }}
    >
      {visible.map((u, i) => (
        <div key={u.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div
              style={{
                background: digitBg,
                color: digitColor,
                fontSize: digitSize,
                fontWeight: 700,
                lineHeight: 1,
                padding: "16px 18px",
                borderRadius: 10,
                minWidth: digitSize * 1.4,
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {pad(u.value)}
            </div>
            {showLabels && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: labelColor,
                }}
              >
                {u.label}
              </span>
            )}
          </div>
          {i < visible.length - 1 && (
            <span
              style={{
                color: separatorColor,
                fontSize: digitSize * 0.6,
                fontWeight: 700,
                lineHeight: 1,
                paddingBottom: showLabels ? 22 : 0,
              }}
            >
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
