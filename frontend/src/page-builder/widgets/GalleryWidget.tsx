import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
  type CSSProperties,
} from "react";
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
  /** Slides visíveis por dispositivo (responsivo). Omisso = 1. */
  carouselSlidesDesktop?: number;
  carouselSlidesTablet?: number;
  carouselSlidesMobile?: number;
  /** Quantos slides avançar por clique / tecla / auto-play. */
  carouselSlidesToScroll?: number;
  /** `contain` ≈ não esticar (miniaturas); `cover` preenche o slide. */
  carouselObjectFit?: "cover" | "contain";
  /** Largura fixa do slide em px (ex. 150); 0 = largura calculada a partir dos slides visíveis. */
  carouselThumbWidthPx?: number;
  /** Duração da animação de deslize (ms). */
  carouselTransitionMs?: number;
  /** Pausar auto-play quando o rato está sobre o carrossel. */
  carouselPauseOnHover?: boolean;
}

const ratioMap: Record<string, string> = {
  auto: "auto",
  square: "1 / 1",
  landscape: "16 / 9",
  portrait: "3 / 4",
};

function slideHasSrc(src: unknown): boolean {
  return typeof src === "string" && src.trim().length > 0;
}

const emptySlideBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 100,
  color: "#64748b",
  fontSize: 11,
  textAlign: "center",
  padding: 10,
  boxSizing: "border-box",
  background: "#f1f5f9",
};

function slidesToShowForDevice(c: Partial<GalleryContent>, device: DeviceType): number {
  const d =
    typeof c.carouselSlidesDesktop === "number" && c.carouselSlidesDesktop >= 1
      ? Math.round(c.carouselSlidesDesktop)
      : 1;
  const t =
    typeof c.carouselSlidesTablet === "number" && c.carouselSlidesTablet >= 1
      ? Math.round(c.carouselSlidesTablet)
      : 1;
  const m =
    typeof c.carouselSlidesMobile === "number" && c.carouselSlidesMobile >= 1
      ? Math.round(c.carouselSlidesMobile)
      : 1;
  const raw = device === "mobile" ? m : device === "tablet" ? t : d;
  return Math.max(1, Math.min(12, raw));
}

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
  const thumbW = typeof c.carouselThumbWidthPx === "number" ? c.carouselThumbWidthPx : 0;
  const objectFit: "cover" | "contain" = c.carouselObjectFit === "contain" ? "contain" : "cover";
  const transitionMs =
    typeof c.carouselTransitionMs === "number" && c.carouselTransitionMs >= 0
      ? Math.min(2000, Math.round(c.carouselTransitionMs))
      : 450;
  const pauseOnHover = (c.carouselPauseOnHover as boolean | undefined) !== false;
  const slidesToScrollCfg = Math.max(
    1,
    Math.min(6, typeof c.carouselSlidesToScroll === "number" ? Math.round(c.carouselSlidesToScroll) : 1),
  );

  const columns = device === "mobile" ? 1 : device === "tablet" ? Math.min(2, baseColumns) : baseColumns;
  const [lightbox, setLightbox] = useState<number | null>(null);
  /** Índice do primeiro slide visível (carrossel multi-slide). */
  const [carouselStart, setCarouselStart] = useState(0);
  /** Métricas medidas no viewport (px reais para transform + flex). */
  const [metrics, setMetrics] = useState({ vw: 0, slidePx: 0, nShow: 1 });
  const [carouselHover, setCarouselHover] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const userSlidesToShow = slidesToShowForDevice(c, device);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el || layout !== "carousel") return;
    const measure = () => {
      const rawW = el.getBoundingClientRect().width;
      const vw = rawW > 4 ? rawW : 0;
      if (images.length === 0) {
        setMetrics({ vw, slidePx: 0, nShow: 1 });
        return;
      }
      let nShow: number;
      let slidePx: number;
      if (thumbW > 0) {
        if (vw > 4) {
          const nFit = Math.max(1, Math.floor((vw + gap) / (thumbW + gap)));
          nShow = Math.min(images.length, nFit, Math.max(1, userSlidesToShow));
        } else {
          nShow = Math.min(images.length, Math.max(1, userSlidesToShow));
        }
        slidePx = thumbW;
      } else {
        nShow = Math.min(images.length, Math.max(1, userSlidesToShow));
        const vwEff = vw > 4 ? vw : 0;
        slidePx =
          nShow > 0 ? (Math.max(vwEff, 280) - (nShow - 1) * gap) / nShow : 0;
      }
      setMetrics({ vw, slidePx, nShow });
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout, device, images.length, gap, thumbW, userSlidesToShow]);

  const slidesToShow = metrics.nShow;
  const slideW = metrics.slidePx;

  const slidesToScroll = Math.min(slidesToScrollCfg, slidesToShow, images.length || 1);

  const maxStart = Math.max(0, images.length - slidesToShow);

  const goNext = useCallback(() => {
    setCarouselStart((s) => {
      if (maxStart <= 0) return 0;
      const next = s + slidesToScroll;
      if (next > maxStart) return 0;
      return next;
    });
  }, [maxStart, slidesToScroll]);

  const goPrev = useCallback(() => {
    setCarouselStart((s) => {
      if (maxStart <= 0) return 0;
      const prev = s - slidesToScroll;
      if (prev < 0) return maxStart;
      return prev;
    });
  }, [maxStart, slidesToScroll]);

  useEffect(() => {
    setCarouselStart((s) => Math.min(s, maxStart));
  }, [maxStart, images.length, slidesToShow, metrics.vw]);

  useEffect(() => {
    if (layout !== "carousel" || !carouselAutoplay || images.length < 2 || maxStart <= 0) return;
    if (pauseOnHover && carouselHover) return;
    const t = window.setInterval(goNext, Math.max(2000, carouselIntervalMs));
    return () => window.clearInterval(t);
  }, [
    layout,
    carouselAutoplay,
    carouselIntervalMs,
    images.length,
    goNext,
    maxStart,
    pauseOnHover,
    carouselHover,
  ]);

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
        <p style={{ textAlign: "center", color: "#64748b", fontSize: 13, lineHeight: 1.55, maxWidth: 320, margin: "0 auto" }}>
          Sem imagens ainda. No painel à direita, use «+ Adicionar» e depois cole um URL ou «Carregar do PC» em cada
          slide.
        </p>
      </div>
    );
  }

  const outer = stylesToCss(widget.styles, device);

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
    const imgStyleCarousel: CSSProperties = {
      width: "100%",
      height: aspectRatio === "auto" ? "auto" : "100%",
      aspectRatio: ratioMap[aspectRatio],
      objectFit,
      display: "block",
      background: objectFit === "contain" ? "#f1f5f9" : undefined,
    };
    const slideWSafe = Math.max(slideW, 1);
    const step = slideWSafe + gap;
    const translatePx = carouselStart > 0 ? -(carouselStart * step) : 0;
    const dotCount = maxStart + 1;
    const showNav = maxStart > 0;

    return (
      <div style={outer}>
        <div
          ref={viewportRef}
          onMouseEnter={() => pauseOnHover && setCarouselHover(true)}
          onMouseLeave={() => setCarouselHover(false)}
          style={{
            position: "relative",
            borderRadius,
            overflow: "hidden",
            background: "#f8fafc",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              gap,
              transition: `transform ${transitionMs}ms cubic-bezier(0.25, 0.1, 0.25, 1)`,
              transform: `translateX(${translatePx}px)`,
              willChange: "transform",
            }}
          >
            {images.map((img, i) => (
              <div
                key={img.id}
                style={{
                  flex: `0 0 ${slideWSafe}px`,
                  width: slideWSafe,
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    if (!enableLightbox || !slideHasSrc(img.src)) return;
                    e.stopPropagation();
                    setLightbox(i);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: enableLightbox && slideHasSrc(img.src) ? "zoom-in" : "default",
                    position: "relative",
                    borderRadius: Math.max(0, borderRadius - 2),
                    overflow: "hidden",
                  }}
                  aria-label={img.alt || `Imagem ${i + 1} de ${images.length}`}
                >
                  {slideHasSrc(img.src) ? (
                    <img
                      src={img.src}
                      alt={img.alt}
                      loading={i < slidesToShow + 2 ? "eager" : "lazy"}
                      style={imgStyleCarousel}
                    />
                  ) : (
                    <div style={{ ...imgStyleCarousel, ...emptySlideBox }}>
                      Sem imagem — no painel à direita: URL ou «Carregar do PC»
                    </div>
                  )}
                  {img.caption ? (
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                        color: "#fff",
                        fontSize: 12,
                        padding: "14px 8px 8px",
                        textAlign: "left",
                      }}
                    >
                      {img.caption}
                    </span>
                  ) : null}
                </button>
              </div>
            ))}
          </div>
          {carouselShowArrows && showNav ? (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                style={{
                  ...navBtnCarousel("left"),
                  background: "rgba(15,23,42,0.5)",
                  color: "#fff",
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Seguinte"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                style={{
                  ...navBtnCarousel("right"),
                  background: "rgba(15,23,42,0.5)",
                  color: "#fff",
                }}
              >
                ›
              </button>
            </>
          ) : null}
        </div>
        {carouselShowDots && showNav && dotCount > 1 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
            }}
            role="navigation"
            aria-label="Posição do carrossel"
          >
            {Array.from({ length: dotCount }, (_, page) => {
              const active = carouselStart === page;
              return (
                <button
                  key={`dot-${page}`}
                  type="button"
                  aria-label={`Ir para posição ${page + 1}`}
                  aria-current={active}
                  onClick={() => setCarouselStart(page)}
                  style={{
                    width: active ? 22 : 8,
                    height: 8,
                    borderRadius: 999,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    background: active ? "#e63946" : "#cbd5e1",
                    transition: "width 0.2s ease, background 0.2s ease",
                  }}
                />
              );
            })}
          </div>
        ) : null}
        {lightboxModal}
      </div>
    );
  }

  const imgStyleGrid: CSSProperties = {
    width: "100%",
    height: aspectRatio === "auto" ? "auto" : "100%",
    aspectRatio: ratioMap[aspectRatio],
    objectFit: "cover",
    display: "block",
  };

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
              if (!enableLightbox || !slideHasSrc(im.src)) return;
              e.stopPropagation();
              setLightbox(i);
            }}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: enableLightbox && slideHasSrc(im.src) ? "zoom-in" : "default",
              borderRadius,
              overflow: "hidden",
              display: "block",
              position: "relative",
            }}
            aria-label={im.alt || `Imagem ${i + 1}`}
          >
            {slideHasSrc(im.src) ? (
              <img src={im.src} alt={im.alt} loading="lazy" style={imgStyleGrid} />
            ) : (
              <div style={{ ...imgStyleGrid, ...emptySlideBox, aspectRatio: ratioMap[aspectRatio] }}>
                Sem imagem — painel à direita: URL ou «Carregar do PC»
              </div>
            )}
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
    [side]: 6,
    width: 40,
    height: 40,
    borderRadius: "50%",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  } as CSSProperties;
}
