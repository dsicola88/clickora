import { useEffect, useState, type ReactNode } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { conditionsNeedRuntime, isHiddenByDevice } from "../widget-conditions";

/**
 * Aplica condições de exibição (dispositivo / atraso / scroll).
 * No editor (editorMode) mostra sempre, excepto hide por dispositivo activo.
 */
export function WidgetConditionGate({
  widget,
  device,
  editorMode = false,
  children,
}: {
  widget: WidgetNode;
  device: DeviceType;
  editorMode?: boolean;
  children: ReactNode;
}) {
  const c = widget.conditions;
  const [ready, setReady] = useState(() => {
    if (editorMode) return true;
    if (!c) return true;
    if (c.showAfterMs && c.showAfterMs > 0) return false;
    if (typeof c.showAtScrollPercent === "number" && c.showAtScrollPercent > 0) return false;
    return true;
  });

  useEffect(() => {
    if (editorMode || !c || !conditionsNeedRuntime(c)) {
      setReady(true);
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const afterMs = Math.max(0, c.showAfterMs ?? 0);
    const scrollNeed =
      typeof c.showAtScrollPercent === "number" && c.showAtScrollPercent > 0
        ? c.showAtScrollPercent
        : null;

    const mark = () => {
      if (!cancelled) setReady(true);
    };

    let timeOk = afterMs <= 0;
    let scrollOk = scrollNeed == null;

    if (afterMs > 0) {
      timer = window.setTimeout(() => {
        timeOk = true;
        if (scrollOk) mark();
      }, afterMs);
    }

    const onScroll = () => {
      if (scrollNeed == null) return;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const pct = (window.scrollY / max) * 100;
      if (pct >= scrollNeed) {
        scrollOk = true;
        if (timeOk) mark();
        window.removeEventListener("scroll", onScroll);
      }
    };
    if (scrollNeed != null) {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    if (timeOk && scrollOk) mark();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [c, editorMode]);

  if (isHiddenByDevice(c, device)) {
    if (editorMode) {
      return (
        <div style={{ opacity: 0.35, outline: "1px dashed #94a3b8" }} title="Oculto neste dispositivo">
          {children}
        </div>
      );
    }
    return null;
  }

  if (!ready) return null;
  return <>{children}</>;
}
