import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

export interface StarRatingContent {
  rating: number;
  max: number;
  size: number;
  color: string;
  emptyColor: string;
  showScore: boolean;
  title: string;
}

export function StarRatingWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const c = widget.content as Partial<StarRatingContent>;
  const max = Math.max(1, Math.min(10, c.max ?? 5));
  const rating = Math.max(0, Math.min(max, c.rating ?? 4.5));
  const size = c.size ?? 22;
  const color = c.color ?? "#f59e0b";
  const emptyColor = c.emptyColor ?? "#e5e7eb";
  const align = resolveResponsive(widget.styles.align, device);

  return (
    <div style={stylesToCssWidgetContent(widget.styles, device)}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems:
            align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
          gap: 6,
        }}
      >
        {c.title ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{c.title}</div>
        ) : null}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            justifyContent: alignToFlexJustify(align),
          }}
          aria-label={`Avaliação ${rating} de ${max}`}
        >
          {Array.from({ length: max }, (_, i) => {
            const fill = Math.max(0, Math.min(1, rating - i));
            return (
              <span
                key={i}
                style={{
                  position: "relative",
                  display: "inline-block",
                  width: size,
                  height: size,
                  fontSize: size,
                  lineHeight: 1,
                  color: emptyColor,
                }}
              >
                ★
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: `${fill * 100}%`,
                    overflow: "hidden",
                    color,
                    whiteSpace: "nowrap",
                  }}
                >
                  ★
                </span>
              </span>
            );
          })}
          {c.showScore !== false ? (
            <span style={{ marginLeft: 6, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
              {rating.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
