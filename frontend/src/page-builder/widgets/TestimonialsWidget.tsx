import { useEffect, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  avatar: string;
  quote: string;
  rating: number;
}

export interface TestimonialsContent {
  items: TestimonialItem[];
  autoplay: boolean;
  intervalMs: number;
  showStars: boolean;
  showAvatars: boolean;
  cardBg: string;
  textColor: string;
  accentColor: string;
}

export function TestimonialsWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<TestimonialsContent>;
  const items = c.items ?? [];
  const autoplay = c.autoplay ?? true;
  const intervalMs = c.intervalMs ?? 5000;
  const showStars = c.showStars ?? true;
  const showAvatars = c.showAvatars ?? true;
  const cardBg = c.cardBg ?? "#ffffff";
  const textColor = c.textColor ?? "#1a1a1a";
  const accentColor = c.accentColor ?? "#f59e0b";

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!autoplay || items.length <= 1) return;
    const t = setInterval(() => {
      setActive((i) => (i + 1) % items.length);
    }, Math.max(1500, intervalMs));
    return () => clearInterval(t);
  }, [autoplay, intervalMs, items.length]);

  if (items.length === 0) {
    return (
      <div style={stylesToCssWidgetContent(widget.styles, device)}>
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Adicione depoimentos no painel de propriedades.
        </p>
      </div>
    );
  }

  const current = items[Math.min(active, items.length - 1)];

  return (
    <div style={stylesToCssWidgetContent(widget.styles, device)}>
      <div
        style={{
          background: cardBg,
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          textAlign: "center",
          color: textColor,
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {showStars && (
          <div style={{ display: "flex", gap: 2, color: accentColor, fontSize: 20 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} style={{ opacity: i < current.rating ? 1 : 0.25 }}>
                ★
              </span>
            ))}
          </div>
        )}
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            margin: 0,
            fontStyle: "italic",
            maxWidth: 640,
          }}
        >
          “{current.quote}”
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          {showAvatars && current.avatar && (
            <img
              src={current.avatar}
              alt={current.name}
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          )}
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{current.name}</div>
            {current.role && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>{current.role}</div>
            )}
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginTop: 16,
          }}
        >
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Depoimento ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setActive(i);
              }}
              style={{
                width: i === active ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: "none",
                background: i === active ? accentColor : "#d1d5db",
                cursor: "pointer",
                transition: "all 0.2s",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
