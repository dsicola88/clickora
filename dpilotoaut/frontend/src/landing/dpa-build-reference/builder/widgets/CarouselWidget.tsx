import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCss } from "../style-utils";

export interface CarouselSlide {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  link?: string;
}

export interface CarouselContent {
  slides: CarouselSlide[];
  autoplay: boolean;
  intervalMs: number;
  showArrows: boolean;
  showDots: boolean;
  loop: boolean;
  aspectRatio: "auto" | "square" | "landscape" | "portrait" | "wide";
  borderRadius: number;
  arrowColor: string;
  dotColor: string;
}

const ratios: Record<string, string> = {
  auto: "auto",
  square: "1 / 1",
  landscape: "16 / 9",
  portrait: "3 / 4",
  wide: "21 / 9",
};

export function CarouselWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<CarouselContent>;
  const slides = c.slides ?? [];
  const autoplay = c.autoplay ?? true;
  const intervalMs = c.intervalMs ?? 4000;
  const showArrows = c.showArrows ?? true;
  const showDots = c.showDots ?? true;
  const loop = c.loop ?? true;
  const aspectRatio = c.aspectRatio ?? "landscape";
  const borderRadius = c.borderRadius ?? 8;
  const arrowColor = c.arrowColor ?? "#ffffff";
  const dotColor = c.dotColor ?? "#ffffff";

  const plugins = autoplay ? [Autoplay({ delay: intervalMs, stopOnInteraction: false })] : [];
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop }, plugins);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  if (slides.length === 0) {
    return (
      <div style={stylesToCss(widget.styles, device)}>
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
          Adicione slides no painel de propriedades.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", ...stylesToCss(widget.styles, device) }}>
      <div ref={emblaRef} style={{ overflow: "hidden", borderRadius }}>
        <div style={{ display: "flex" }}>
          {slides.map((s) => (
            <div key={s.id} style={{ flex: "0 0 100%", minWidth: 0, position: "relative" }}>
              {s.link ? (
                <a href={s.link} style={{ display: "block" }}>
                  <SlideImg slide={s} aspectRatio={aspectRatio} />
                </a>
              ) : (
                <SlideImg slide={s} aspectRatio={aspectRatio} />
              )}
              {s.caption && (
                <div
                  style={{
                    position: "absolute",
                    inset: "auto 0 0 0",
                    background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
                    color: "#fff",
                    padding: "32px 20px 16px",
                    fontSize: 14,
                  }}
                >
                  {s.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showArrows && slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={(e) => {
              e.stopPropagation();
              emblaApi?.scrollPrev();
            }}
            style={arrowBtn("left", arrowColor)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo"
            onClick={(e) => {
              e.stopPropagation();
              emblaApi?.scrollNext();
            }}
            style={arrowBtn("right", arrowColor)}
          >
            ›
          </button>
        </>
      )}

      {showDots && slides.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                emblaApi?.scrollTo(i);
              }}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: i === selected ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: "none",
                background: dotColor,
                opacity: i === selected ? 1 : 0.5,
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

  function SlideImg({ slide, aspectRatio }: { slide: CarouselSlide; aspectRatio: string }) {
    return (
      <img
        src={slide.src}
        alt={slide.alt}
        loading="lazy"
        style={{
          width: "100%",
          aspectRatio: ratios[aspectRatio],
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }
}

function arrowBtn(side: "left" | "right", color: string): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 12,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.45)",
    border: "none",
    color,
    fontSize: 24,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  } as React.CSSProperties;
}
