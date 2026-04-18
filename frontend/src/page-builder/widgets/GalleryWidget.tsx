import { useState, useEffect, useCallback, type CSSProperties } from "react";
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
  /** Default `grid` when omitted — backwards compatible. */
  layout?: "grid" | "carousel";
  carouselAutoplay?: boolean;
  carouselIntervalMs?: number;
  carouselShowDots?: boolean;
  carouselShowArrows?: boolean;
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
  const layout = c.layout === "carousel" ? "carousel" : "grid";
  const carouselAutoplay = c.carouselAutoplay ?? true;
  const carouselIntervalMs = c.carouselIntervalMs ?? 4500;
  const carouselShowDots = c.carouselShowDots ?? true;
  const carouselShowArrows = c.carouselShowArrows ?? true;

  const columns = device === "mobile" ? 1 : device === "tablet" ? Math.min(2, baseColumns) : baseColumns;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const goNext = useCallback(
    () => setCarouselIndex((i) => (images.length ? (i + 1) % images.length : 0)),
    [images.length],
  );
  const goPrev = useCallback(
    () => setCarouselIndex((i) => (images.length ? (i - 1 + images.length) % images.length : 0)),
    [images.length],
  );

  useEffect(() => {
    setCarouselIndex((i) => (images.length ? Math.min(i, images.length - 1) : 0));
  }, [images.length]);

  useEffect(() => {
    if (layout !== "carousel" || !carouselAutoplay || images.length < 2) return;
    const t = window.setInterval(goNext, Math.max(2000, carouselIntervalMs));
    return () => window.clearInterval(t);
  }, [layout, carouselAutoplay, carouselIntervalMs, images.length, goNext]);

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

  useEffect(() => {
    if (layout !== "carousel" || lightbox !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layout, lightbox, goNext, goPrev]);

  if (images.length === 0) {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Adicione imagens no painel de propriedades.
        </p>
      </div>
    );
  }

  const outer = stylesToCss(widget.styles, device);

  const imgStyle: CSSProperties = {
    width: "100%",
    height: aspectRatio === "auto" ? "auto" : "100%",
    aspectRatio: ratioMap[aspectRatio],
    objectFit: "cover",
    display: "block",
    transition: "transform 0.3s ease",
  };

  const lightboxModal =
    enableLightbox && lightbox !== null ? (
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
                setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length));
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
    ) : null;

  if (layout === "carousel") {
    const img = images[carouselIndex];
    return (
      <div style={outer}>
        <div
          style={{
            position: "relative",
            borderRadius,
            overflow: "hidden",
            background: "#f8fafc",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              if (!enableLightbox) return;
              e.stopPropagation();
              setLightbox(carouselIndex);
            }}
            style={{
              display: "block",
              width: "100%",
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: enableLightbox ? "zoom-in" : "default",
              position: "relative",
            }}
            aria-label={img.alt || `Imagem ${carouselIndex + 1} de ${images.length}`}
          >
            <img src={img.src} alt={img.alt} loading="lazy" style={imgStyle} />
            {img.caption ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                  color: "#fff",
                  fontSize: 13,
                  padding: "18px 14px 10px",
                  textAlign: "left",
                }}
              >
                {img.caption}
              </span>
            ) : null}
          </button>
          {carouselShowArrows && images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Imagem anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                style={{
                  ...navBtnCarousel("left"),
                  background: "rgba(15,23,42,0.45)",
                  color: "#fff",
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Imagem seguinte"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                style={{
                  ...navBtnCarousel("right"),
                  background: "rgba(15,23,42,0.45)",
                  color: "#fff",
                }}
              >
                ›
              </button>
            </>
          ) : null}
        </div>
        {carouselShowDots && images.length > 1 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {images.map((_, i) => (
              <button
                key={images[i].id}
                type="button"
                aria-label={`Ir para imagem ${i + 1}`}
                aria-current={i === carouselIndex}
                onClick={() => setCarouselIndex(i)}
                style={{
                  width: i === carouselIndex ? 22 : 8,
                  height: 8,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  background: i === carouselIndex ? "#e63946" : "#cbd5e1",
                  transition: "width 0.2s ease, background 0.2s ease",
                }}
              />
            ))}
          </div>
        ) : null}
        {lightboxModal}
      </div>
    );
  }

  return (
    <div style={outer}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: `${gap}px`,
        }}
      >
        {images.map((im, i) => (
          <button
            key={im.id}
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
            aria-label={im.alt || `Imagem ${i + 1}`}
          >
            <img src={im.src} alt={im.alt} loading="lazy" style={imgStyle} />
            {im.caption && (
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
                {im.caption}
              </span>
            )}
          </button>
        ))}
      </div>
      {lightboxModal}
    </div>
  );
}

function navBtn(side: "left" | "right"): CSSProperties {
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
  } as CSSProperties;
}

function navBtnCarousel(side: "left" | "right"): CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 10,
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    fontSize: 26,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  } as CSSProperties;
}
