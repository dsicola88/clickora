import { useState } from "react";
import { useLandingSalesTheme } from "@/contexts/LandingPageThemeContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LandingGallery } from "@/lib/plansLandingExtras";

type Props = {
  data: LandingGallery;
  salesDark: boolean;
  className?: string;
};

export function LandingGallerySection({ data, salesDark, className }: Props) {
  const t = useLandingSalesTheme();
  const items =
    data.items?.filter((it) => it.image_url.trim()) ?? [];
  const [lightbox, setLightbox] = useState<string | null>(null);

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
              salesDark ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {items.map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setLightbox(item.image_url)}
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
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/75">
                    {item.role.trim()}
                  </p>
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
        ))}
      </div>

      <Dialog open={Boolean(lightbox)} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent
          className="max-w-4xl w-[min(100vw-2rem,56rem)] gap-0 border-0 bg-black p-0 overflow-hidden sm:rounded-xl"
          aria-describedby={undefined}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Imagem</DialogTitle>
          </DialogHeader>
          {lightbox ? (
            <img
              src={lightbox}
              alt=""
              className="max-h-[85vh] w-full object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
