import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface CtaBoxContent {
  title: string;
  description: string;
  primaryText: string;
  primaryHref: string;
  secondaryText?: string;
  secondaryHref?: string;
  layout: "centered" | "split";
  background: string;
  gradient?: string;
  textColor: string;
  primaryBg: string;
  primaryColor: string;
  borderRadius: number;
  imageUrl?: string;
}

export function CtaBoxWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<CtaBoxContent>;
  const title = c.title ?? "Pronto para começar?";
  const description =
    c.description ?? "Junte-se a centenas de clientes satisfeitos e veja resultados em dias.";
  const primaryText = c.primaryText ?? "Começar agora";
  const primaryHref = c.primaryHref ?? "#";
  const secondaryText = c.secondaryText ?? "";
  const secondaryHref = c.secondaryHref ?? "#";
  const layout = c.layout ?? "centered";
  const background = c.background ?? "#0f172a";
  const gradient = c.gradient ?? "";
  const textColor = c.textColor ?? "#ffffff";
  const primaryBg = c.primaryBg ?? "#e63946";
  const primaryColor = c.primaryColor ?? "#ffffff";
  const borderRadius = c.borderRadius ?? 16;
  const imageUrl = c.imageUrl ?? "";

  const containerBg = gradient || background;

  const buttons = (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        justifyContent: layout === "centered" ? "center" : "flex-start",
      }}
    >
      <a
        href={primaryHref}
        className="btn"
        style={{
          background: primaryBg,
          color: primaryColor,
          padding: "14px 28px",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 15,
          textDecoration: "none",
          display: "inline-block",
        }}
        onClick={(e) => {
          if (primaryHref === "#") e.preventDefault();
        }}
      >
        {primaryText}
      </a>
      {secondaryText && (
        <a
          href={secondaryHref}
          className="btn"
          style={{
            background: "transparent",
            color: textColor,
            padding: "14px 28px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: "none",
            border: `1px solid ${textColor}55`,
            display: "inline-block",
          }}
          onClick={(e) => {
            if (secondaryHref === "#") e.preventDefault();
          }}
        >
          {secondaryText}
        </a>
      )}
    </div>
  );

  return (
    <div style={stylesToCss(widget.styles, device)}>
      <div
        style={{
          background: containerBg,
          color: textColor,
          borderRadius,
          padding: layout === "centered" ? "48px 32px" : "40px 32px",
          display: "flex",
          flexDirection: layout === "centered" ? "column" : "row",
          alignItems: "center",
          gap: 32,
          textAlign: layout === "centered" ? "center" : "left",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.15,
              color: textColor,
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: "12px 0 24px",
              fontSize: 16,
              lineHeight: 1.6,
              opacity: 0.85,
            }}
          >
            {description}
          </p>
          {buttons}
        </div>
        {layout === "split" && imageUrl && (
          <div style={{ flex: "0 0 auto", maxWidth: 280 }}>
            <img
              src={imageUrl}
              alt=""
              style={{ width: "100%", height: "auto", borderRadius: 12, display: "block" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
