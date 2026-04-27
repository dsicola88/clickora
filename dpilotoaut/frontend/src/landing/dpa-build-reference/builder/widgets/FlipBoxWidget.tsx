import { useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface FlipBoxContent {
  frontTitle: string;
  frontSubtitle: string;
  frontIcon?: string;
  frontBg: string;
  frontTextColor: string;
  backTitle: string;
  backDescription: string;
  backCtaText?: string;
  backCtaHref?: string;
  backBg: string;
  backTextColor: string;
  backCtaBg: string;
  backCtaColor: string;
  height: number;
  borderRadius: number;
  trigger: "hover" | "click";
  flipDirection: "horizontal" | "vertical";
}

export function FlipBoxWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<FlipBoxContent>;
  const frontTitle = c.frontTitle ?? "Hover aqui";
  const frontSubtitle = c.frontSubtitle ?? "Veja mais detalhes";
  const frontIcon = c.frontIcon ?? "✨";
  const frontBg = c.frontBg ?? "#1f2937";
  const frontTextColor = c.frontTextColor ?? "#ffffff";
  const backTitle = c.backTitle ?? "Detalhes";
  const backDescription =
    c.backDescription ?? "Aqui você pode adicionar mais informações sobre este recurso.";
  const backCtaText = c.backCtaText ?? "Saiba mais";
  const backCtaHref = c.backCtaHref ?? "#";
  const backBg = c.backBg ?? "#e63946";
  const backTextColor = c.backTextColor ?? "#ffffff";
  const backCtaBg = c.backCtaBg ?? "#ffffff";
  const backCtaColor = c.backCtaColor ?? "#e63946";
  const height = c.height ?? 280;
  const borderRadius = c.borderRadius ?? 12;
  const trigger = c.trigger ?? "hover";
  const flipDirection = c.flipDirection ?? "horizontal";

  const [flipped, setFlipped] = useState(false);
  const isFlipped = trigger === "click" ? flipped : false;
  const rotateAxis = flipDirection === "horizontal" ? "Y" : "X";

  const faceBase: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    borderRadius,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  };

  return (
    <div style={stylesToCss(widget.styles, device)}>
      <div
        style={{
          perspective: 1200,
          height,
          cursor: trigger === "click" ? "pointer" : "default",
        }}
        onClick={() => trigger === "click" && setFlipped((v) => !v)}
        className={trigger === "hover" ? "lov-flipbox-hover" : ""}
      >
        <style>{`
          .lov-flipbox-hover:hover .lov-flipbox-inner { transform: rotate${rotateAxis}(180deg); }
        `}</style>
        <div
          className="lov-flipbox-inner"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transition: "transform 0.7s cubic-bezier(0.4, 0.2, 0.2, 1)",
            transform: isFlipped ? `rotate${rotateAxis}(180deg)` : "none",
          }}
        >
          {/* Front */}
          <div style={{ ...faceBase, background: frontBg, color: frontTextColor }}>
            {frontIcon && <div style={{ fontSize: 48, marginBottom: 12 }}>{frontIcon}</div>}
            <h4 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{frontTitle}</h4>
            {frontSubtitle && (
              <p style={{ margin: "8px 0 0", fontSize: 14, opacity: 0.85 }}>{frontSubtitle}</p>
            )}
          </div>
          {/* Back */}
          <div
            style={{
              ...faceBase,
              background: backBg,
              color: backTextColor,
              transform: `rotate${rotateAxis}(180deg)`,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{backTitle}</h4>
            <p
              style={{
                margin: "10px 0 16px",
                fontSize: 14,
                lineHeight: 1.55,
                opacity: 0.95,
              }}
            >
              {backDescription}
            </p>
            {backCtaText && (
              <a
                href={backCtaHref}
                className="btn"
                style={{
                  background: backCtaBg,
                  color: backCtaColor,
                  padding: "10px 20px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
                onClick={(e) => {
                  if (backCtaHref === "#") e.preventDefault();
                }}
              >
                {backCtaText}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
