import { useEffect, useRef, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export interface CounterContent {
  start: number;
  end: number;
  durationMs: number;
  prefix: string;
  suffix: string;
  title: string;
  numberColor: string;
  titleColor: string;
}

export function CounterWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<CounterContent>;
  const start = c.start ?? 0;
  const end = c.end ?? 1000;
  const durationMs = Math.max(200, c.durationMs ?? 1600);
  const align = resolveResponsive(widget.styles.align, device);
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(start);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!ref.current || started) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(start + (end - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, start, end, durationMs]);

  return (
    <div ref={ref} style={stylesToCssWidgetContent(widget.styles, device)}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems:
            align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
          textAlign: align ?? "left",
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            lineHeight: 1.1,
            color: c.numberColor ?? "#0f172a",
            display: "inline-flex",
            justifyContent: alignToFlexJustify(align),
            gap: 2,
          }}
        >
          <span>{c.prefix ?? ""}</span>
          <span>{value.toLocaleString("pt-BR")}</span>
          <span>{c.suffix ?? ""}</span>
        </div>
        {c.title ? (
          <div style={{ fontSize: 14, fontWeight: 500, color: c.titleColor ?? "#64748b" }}>
            {c.title}
          </div>
        ) : null}
      </div>
    </div>
  );
}
