import { useState, useEffect } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  caption?: string;
}

export interface GalleryContent {
  images: GalleryImage[];
  columns: number;
  gap: number;
  borderRadius: number;
  enableLightbox: boolean;
  aspectRatio: "auto" | "square" | "landscape" | "portrait";
}

const ratioMap: Record<string, string> = {
  auto: "auto",
  square: "1 / 1",
  landscape: "16 / 9",
  portrait: "3 / 4",
};

export function GalleryWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<GalleryContent>;
  const images = c.images ?? [];
  const baseColumns = c.columns ?? 3;
  const gap = c.gap ?? 12;
  const borderRadius = c.borderRadius ?? 8;
  const enableLightbox = c.enableLightbox ?? true;
  const aspectRatio = c.aspectRatio ?? "square";

  const columns = device === "mobile" ? 1 : device === "tablet" ? Math.min(2, baseColumns) : baseColumns;
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % images.length));
      if (e.key === "ArrowLeft")
        setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, images.length]);

  if (images.length === 0) {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Adicione imagens no painel de propriedades.
        </p>
      </div>
    );
  }

  return (
    <div style={stylesToCss(widget.styles, device)}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap}px`,
        }}
      >
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={(e) => {
              if (!enableLightbox) return;
              e.stopPropagation();
              setLightbox(i);
            }}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: enableLightbox ? "zoom-in" : "default",
              borderRadius,
              overflow: "hidden",
              display: "block",
              position: "relative",
            }}
            aria-label={img.alt || `Imagem ${i + 1}`}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              style={{
                width: "100%",
                height: aspectRatio === "auto" ? "auto" : "100%",
                aspectRatio: ratioMap[aspectRatio],
                objectFit: "cover",
                display: "block",
                transition: "transform 0.3s ease",
              }}
            />
            {img.caption && (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                  color: "#fff",
                  fontSize: 12,
                  padding: "16px 10px 8px",
                  textAlign: "left",
                }}
              >
                {img.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {enableLightbox && lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          <img
            src={images[lightbox].src}
            alt={images[lightbox].alt}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: 4,
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            aria-label="Fechar"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            ×
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((i) =>
                    i === null ? null : (i - 1 + images.length) % images.length,
                  );
                }}
                aria-label="Anterior"
                style={navBtn("left")}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((i) => (i === null ? null : (i + 1) % images.length));
                }}
                aria-label="Próxima"
                style={navBtn("right")}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function navBtn(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 16,
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    border: "none",
    color: "#fff",
    fontSize: 28,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties;
}
