import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { SectionBackgroundOverlay, SectionNode, ShapeDividerConfig } from "./types";

/** Presets SVG para divisores de forma na secção. */
export const SHAPE_DIVIDER_PRESETS = [
  { value: "none", label: "Nenhum" },
  { value: "waves", label: "Ondas" },
  { value: "waves-brush", label: "Ondas (pincel)" },
  { value: "curve", label: "Curva" },
  { value: "curve-asym", label: "Curva assimétrica" },
  { value: "tilt", label: "Inclinação" },
  { value: "triangle", label: "Triângulo" },
  { value: "triangle-asym", label: "Triângulo assimétrico" },
  { value: "mountains", label: "Montanhas" },
  { value: "drops", label: "Gotas" },
  { value: "zigzag", label: "Zigzag" },
] as const;

export type ShapeDividerPreset = (typeof SHAPE_DIVIDER_PRESETS)[number]["value"];

const PATHS: Record<Exclude<ShapeDividerPreset, "none">, string> = {
  waves: "M0,40 C120,80 240,0 360,40 C480,80 600,0 720,40 L720,120 L0,120 Z",
  "waves-brush":
    "M0,60 C80,20 160,100 240,60 C320,20 400,100 480,55 C560,10 640,90 720,50 L720,120 L0,120 Z",
  curve: "M0,80 Q360,0 720,80 L720,120 L0,120 Z",
  "curve-asym": "M0,100 Q180,0 720,70 L720,120 L0,120 Z",
  tilt: "M0,100 L720,20 L720,120 L0,120 Z",
  triangle: "M0,120 L360,20 L720,120 Z",
  "triangle-asym": "M0,120 L480,10 L720,120 Z",
  mountains: "M0,120 L120,40 L240,90 L400,20 L560,85 L720,35 L720,120 Z",
  drops: "M0,80 Q90,20 180,80 Q270,20 360,80 Q450,20 540,80 Q630,20 720,80 L720,120 L0,120 Z",
  zigzag: "M0,80 L90,40 L180,80 L270,40 L360,80 L450,40 L540,80 L630,40 L720,80 L720,120 L0,120 Z",
};

export function resolveOverlay(section: SectionNode): SectionBackgroundOverlay | null {
  const o = section.backgroundOverlay;
  if (!o) return null;
  const color = (o.color ?? "").trim();
  if (!color) return null;
  return o;
}

function escapeUrl(url: string) {
  return url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function SectionSlideshow({
  urls,
  intervalMs,
  size,
  position,
}: {
  urls: string[];
  intervalMs: number;
  size: string;
  position: string;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (urls.length < 2) return;
    const t = window.setInterval(
      () => setIndex((i) => (i + 1) % urls.length),
      Math.max(1500, intervalMs),
    );
    return () => clearInterval(t);
  }, [urls, intervalMs]);

  return (
    <>
      {urls.map((url, i) => (
        <div
          key={`${url}-${i}`}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${escapeUrl(url)}")`,
            backgroundSize: size,
            backgroundPosition: position,
            backgroundRepeat: "no-repeat",
            opacity: i === index ? 1 : 0,
            transition: "opacity 900ms ease",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      ))}
    </>
  );
}

export function SectionBackgroundLayers({
  section,
  children,
}: {
  section: SectionNode;
  children?: ReactNode;
}) {
  const overlay = resolveOverlay(section);
  const bgImage = (section.backgroundImageUrl ?? "").trim();
  const slides = (section.backgroundSlideshow ?? [])
    .map((u) => u.trim())
    .filter(Boolean);
  const layers: ReactNode[] = [];

  if (slides.length > 0) {
    layers.push(
      <SectionSlideshow
        key="slideshow"
        urls={slides}
        intervalMs={section.backgroundSlideshowMs ?? 5000}
        size={section.backgroundImageSize ?? "cover"}
        position={section.backgroundImagePosition ?? "center center"}
      />,
    );
  } else if (bgImage) {
    layers.push(
      <div
        key="bg-image"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${escapeUrl(bgImage)}")`,
          backgroundSize: section.backgroundImageSize ?? "cover",
          backgroundPosition: section.backgroundImagePosition ?? "center center",
          backgroundRepeat: "no-repeat",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />,
    );
  }

  if (overlay) {
    const opacity = Math.min(100, Math.max(0, overlay.opacity ?? 50)) / 100;
    layers.push(
      <div
        key="overlay"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: overlay.color,
          opacity,
          mixBlendMode: (overlay.blendMode as CSSProperties["mixBlendMode"]) || "normal",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />,
    );
  }

  const top = section.shapeDividerTop;
  const bottom = section.shapeDividerBottom;
  if (top?.preset && top.preset !== "none") {
    layers.push(<ShapeDivider key="shape-top" config={top} placement="top" />);
  }
  if (bottom?.preset && bottom.preset !== "none") {
    layers.push(<ShapeDivider key="shape-bottom" config={bottom} placement="bottom" />);
  }

  return (
    <>
      {layers}
      {children}
    </>
  );
}

function ShapeDivider({
  config,
  placement,
}: {
  config: ShapeDividerConfig;
  placement: "top" | "bottom";
}) {
  const preset = (config.preset ?? "none") as ShapeDividerPreset;
  if (preset === "none") return null;
  const path = PATHS[preset];
  if (!path) return null;
  const height = Math.min(400, Math.max(8, config.heightPx ?? 80));
  const flip = Boolean(config.flip);
  const invert = Boolean(config.invert);
  const color = config.color?.trim() || "#ffffff";
  const bringToFront = Boolean(config.bringToFront);

  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    height,
    lineHeight: 0,
    pointerEvents: "none",
    zIndex: bringToFront ? 3 : 1,
    overflow: "hidden",
    ...(placement === "top"
      ? { top: 0, transform: invert ? "scaleY(-1)" : undefined }
      : { bottom: 0, transform: invert ? undefined : "scaleY(-1)" }),
  };

  return (
    <div aria-hidden style={style}>
      <svg
        viewBox="0 0 720 120"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{
          display: "block",
          width: "calc(100% + 1.5px)",
          transform: flip ? "scaleX(-1)" : undefined,
        }}
      >
        <path d={path} fill={color} />
      </svg>
    </div>
  );
}

/** Secção precisa de position:relative quando tem chrome (overlay/imagem/shapes/vídeo). */
export function sectionNeedsRelativeChrome(section: SectionNode, hasBgVideo: boolean): boolean {
  if (hasBgVideo) return true;
  if ((section.backgroundImageUrl ?? "").trim()) return true;
  if ((section.backgroundSlideshow ?? []).some((u) => u.trim())) return true;
  if (resolveOverlay(section)) return true;
  const top = section.shapeDividerTop?.preset;
  const bottom = section.shapeDividerBottom?.preset;
  if (top && top !== "none") return true;
  if (bottom && bottom !== "none") return true;
  return false;
}
