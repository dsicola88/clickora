import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { Check, X } from "lucide-react";

export interface PriceFeature {
  id: string;
  text: string;
  included: boolean;
}

export interface PriceTableContent {
  badge?: string;
  title: string;
  subtitle?: string;
  currency: string;
  price: string;
  period: string;
  features: PriceFeature[];
  ctaText: string;
  ctaHref: string;
  highlighted: boolean;
  cardBg: string;
  textColor: string;
  accentColor: string;
  ctaBg: string;
  ctaColor: string;
  borderRadius: number;
}

export function PriceTableWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<PriceTableContent>;
  const badge = c.badge ?? "";
  const title = c.title ?? "Pro";
  const subtitle = c.subtitle ?? "Para quem quer crescer";
  const currency = c.currency ?? "R$";
  const price = c.price ?? "97";
  const period = c.period ?? "/mês";
  const features = c.features ?? [
    { id: "1", text: "Recurso 1 incluso", included: true },
    { id: "2", text: "Recurso 2 incluso", included: true },
    { id: "3", text: "Recurso 3 incluso", included: true },
    { id: "4", text: "Recurso premium", included: false },
  ];
  const ctaText = c.ctaText ?? "Assinar agora";
  const ctaHref = c.ctaHref ?? "#";
  const highlighted = c.highlighted ?? false;
  const cardBg = c.cardBg ?? "#ffffff";
  const textColor = c.textColor ?? "#1a1a1a";
  const accentColor = c.accentColor ?? "#e63946";
  const ctaBg = c.ctaBg ?? "#e63946";
  const ctaColor = c.ctaColor ?? "#ffffff";
  const borderRadius = c.borderRadius ?? 12;

  return (
    <div style={stylesToCssWidgetContent(widget.styles, device)}>
      <div
        style={{
          background: cardBg,
          color: textColor,
          borderRadius,
          padding: "32px 24px",
          border: highlighted ? `2px solid ${accentColor}` : "1px solid #e5e7eb",
          boxShadow: highlighted
            ? `0 20px 40px -12px ${accentColor}33`
            : "0 4px 12px -2px rgba(0,0,0,0.06)",
          position: "relative",
          transform: highlighted ? "scale(1.02)" : "none",
          transition: "transform 0.2s",
        }}
      >
        {badge && (
          <div
            style={{
              position: "absolute",
              top: -12,
              left: "50%",
              transform: "translateX(-50%)",
              background: accentColor,
              color: "#fff",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {badge}
          </div>
        )}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{title}</h3>
          {subtitle && (
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.7 }}>{subtitle}</p>
          )}
        </div>
        <div
          style={{
            textAlign: "center",
            marginBottom: 28,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 600, alignSelf: "flex-start", marginTop: 6 }}>
            {currency}
          </span>
          <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, color: accentColor }}>
            {price}
          </span>
          <span style={{ fontSize: 14, opacity: 0.65 }}>{period}</span>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "grid", gap: 10 }}>
          {features.map((f) => (
            <li
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                opacity: f.included ? 1 : 0.45,
                textDecoration: f.included ? "none" : "line-through",
              }}
            >
              {f.included ? (
                <Check size={16} style={{ color: accentColor, flexShrink: 0 }} />
              ) : (
                <X size={16} style={{ color: "#9ca3af", flexShrink: 0 }} />
              )}
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
        <a
          href={ctaHref}
          className="btn"
          style={{
            display: "block",
            background: ctaBg,
            color: ctaColor,
            padding: "14px 24px",
            borderRadius: 8,
            textAlign: "center",
            fontWeight: 600,
            fontSize: 15,
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
          onClick={(e) => {
            if (ctaHref === "#") e.preventDefault();
          }}
        >
          {ctaText}
        </a>
      </div>
    </div>
  );
}
