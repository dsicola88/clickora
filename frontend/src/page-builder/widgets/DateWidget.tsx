import { useEffect, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface DateWidgetContent {
  source: "now" | "fixed";
  fixedDate: string;
  format: "long" | "short" | "numeric" | "time" | "datetime";
  locale: string;
  prefix: string;
  suffix: string;
  fontSize: number;
  color: string;
  fontWeight: number;
}

function fmt(date: Date, format: string, locale: string): string {
  try {
    if (format === "time") {
      return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
    }
    if (format === "datetime") {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    }
    if (format === "numeric") {
      return new Intl.DateTimeFormat(locale).format(date);
    }
    if (format === "short") {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
    }
    return new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function DateWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<DateWidgetContent>;
  const source = c.source ?? "now";
  const format = c.format ?? "long";
  const locale = c.locale ?? "pt-BR";
  const fontSize = c.fontSize ?? 16;
  const color = c.color ?? "#0f172a";
  const fontWeight = c.fontWeight ?? 500;

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    if (source !== "now" || (format !== "time" && format !== "datetime")) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [source, format]);

  const date = source === "fixed" && c.fixedDate ? new Date(c.fixedDate) : now;
  const text = Number.isNaN(date.getTime()) ? "—" : fmt(date, format, locale);

  return (
    <div style={{ fontSize, color, fontWeight, ...stylesToCss(widget.styles, device) }}>
      {c.prefix ? `${c.prefix} ` : ""}
      {text}
      {c.suffix ? ` ${c.suffix}` : ""}
    </div>
  );
}
