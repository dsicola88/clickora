import { useEffect, useState } from "react";
import { useLandingSalesTheme } from "@/contexts/LandingPageThemeContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { LandingGallery, LandingGalleryItem } from "@/lib/plansLandingExtras";
import {
  galleryCarouselItemBasisClasses,
  resolveGalleryCarouselOptions,
} from "@/lib/landingGalleryCarousel";

type Props = {
  data: LandingGallery;
  salesDark: boolean;
  className?: string;
};

function GallerySlideCard({
  item,
  index,
  salesDark,
  onOpen,
}: {
  item: LandingGalleryItem;
  index: number;
  salesDark: boolean;
  onOpen: (url: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.image_url)}
      className={cn(
        "group relative aspect-[9/16] w-full overflow-hidden rounded-xl text-left shadow-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2",
        salesDark
          ? "ring-1 ring-white/10 focus-visible:ring-offset-[#050a18]"
          : "border border-border focus-visible:ring-offset-background",
      )}
      aria-label={item.name?.trim() || `Imagem ${index + 1}`}
    >
      <img
        src={item.image_url}
        alt={item.caption?.trim() || item.name?.trim() || ""}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"
        aria-hidden
      />
      {item.social_handle?.trim() ? (
        <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm">
          {item.social_handle.trim()}
        </div>
      ) : null}
      {(item.name?.trim() || item.role?.trim() || item.caption?.trim()) && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3 pt-10">
          {item.role?.trim() ? (
            <p className="text-[10px] font-medium uppercase tracking-wide text-white/75">{item.role.trim()}</p>
          ) : null}
          {item.name?.trim() ? (
            <p className="text-sm font-bold leading-tight text-white">{item.name.trim()}</p>
          ) : null}
          {item.caption?.trim() && !item.name?.trim() ? (
            <p className="text-xs text-white/90 line-clamp-2">{item.caption.trim()}</p>
          ) : null}
        </div>
      )}
    </button>
  );
}

export function LandingGallerySection({ data, salesDark, className }: Props) {
  const t = useLandingSalesTheme();
  const items = data.items?.filter((it) => it.image_url.trim()) ?? [];
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const isCarousel = data.display === "carousel";
  const opt = resolveGalleryCarouselOptions(data.carousel);
  const sm = (opt.slides_mobile === 2 ? 2 : 1) as 1 | 2;
  const sd = (Math.min(4, Math.max(1, opt.slides_desktop)) || 3) as 1 | 2 | 3 | 4;
  const itemBasis = galleryCarouselItemBasisClasses(sm, sd);

  useEffect(() => {
    if (!carouselApi) return;
    const onSel = () => setCarouselIndex(carouselApi.selectedScrollSnap());
    onSel();
    carouselApi.on("select", onSel);
    carouselApi.on("reInit", onSel);
    return () => {
      carouselApi.off("select", onSel);
      carouselApi.off("reInit", onSel);
    };
  }, [carouselApi]);

  useEffect(() => {
    if (!isCarousel || !carouselApi || !opt.autoplay) return;
    const id = window.setInterval(() => {
      if (opt.loop) {
        carouselApi.scrollNext();
      } else if (carouselApi.canScrollNext()) {
        carouselApi.scrollNext();
      } else {
        carouselApi.scrollTo(0);
      }
    }, opt.interval_ms);
    return () => window.clearInterval(id);
  }, [carouselApi, isCarousel, opt.autoplay, opt.interval_ms, opt.loop]);

  if (!items.length) return null;

  const title = data.title?.trim() || "Galeria";
  const subtitle = data.subtitle?.trim() ?? "";

  return (
    <section className={cn("space-y-8", className)}>
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <h2
          className={cn("text-2xl font-bold tracking-tight md:text-3xl", !salesDark && "text-primary")}
          style={salesDark ? { color: t.link } : undefined}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            className={cn(
              "text-sm md:text-base whitespace-pre-line leading-relaxed",
              !salesDark && "text-muted-foreground",
            )}
            style={salesDark ? { color: t.muted_on_dark } : undefined}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {isCarousel ? (
        <div className="relative mx-auto max-w-6xl px-2 md:px-10">
          <Carousel
            setApi={setCarouselApi}
            opts={{
              align: "start",
              loop: opt.loop,
              skipSnaps: false,
            }}
            className="w-full"
          >
            <CarouselContent
              className="-ml-2 md:-ml-4"
              style={{ gap: opt.gap_px }}
            >
              {items.map((item, index) => (
                <CarouselItem key={index} className={cn("pl-2 md:pl-4", itemBasis)}>
                  <GallerySlideCard
                    item={item}
                    index={index}
                    salesDark={salesDark}
                    onOpen={setLightbox}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            {opt.show_arrows && (
              <>
                <CarouselPrevious
                  className={cn(
                    "border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white",
                    "left-0 md:-left-1 disabled:opacity-30",
                  )}
                />
                <CarouselNext
                  className={cn(
                    "border-white/20 bg-black/40 text-white hover:bg-black/60 hover:text-white",
                    "right-0 md:-right-1 disabled:opacity-30",
                  )}
                />
              </>
            )}
          </Carousel>
          {opt.show_dots && items.length > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-colors",
                    i === carouselIndex
                      ? "bg-white"
                      : salesDark
                        ? "bg-white/35 hover:bg-white/55"
                        : "bg-muted-foreground/40 hover:bg-muted-foreground/60",
                  )}
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => carouselApi?.scrollTo(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {items.map((item, index) => (
            <GallerySlideCard
              key={index}
              item={item}
              index={index}
              salesDark={salesDark}
              onOpen={setLightbox}
            />
          ))}
        </div>
      )}

      <Dialog open={Boolean(lightbox)} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent
          className="max-w-4xl w-[min(100vw-2rem,56rem)] gap-0 border-0 bg-black p-0 overflow-hidden sm:rounded-xl"
          aria-describedby={undefined}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Imagem</DialogTitle>
          </DialogHeader>
          {lightbox ? (
            <img src={lightbox} alt="" className="max-h-[85vh] w-full object-contain" />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
