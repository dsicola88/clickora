import { useState } from "react";
import { Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { resolveVideoEmbedUrl } from "@/lib/resolveVideoEmbed";
import type { LandingTestimonials } from "@/lib/plansLandingExtras";

type Props = {
  data: LandingTestimonials;
  salesDark: boolean;
  className?: string;
};

function TestimonialVideoDialog({
  videoUrl,
  open,
  onOpenChange,
  label,
}: {
  videoUrl: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
}) {
  const resolved = resolveVideoEmbedUrl(videoUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-4xl w-[min(100vw-2rem,56rem)] gap-0 border-0 bg-black p-0 text-white sm:rounded-xl overflow-hidden",
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{label || "Vídeo"}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full bg-black">
          {!resolved ? (
            <div className="p-8 text-center text-sm text-white/80">
              URL de vídeo não suportada para incorporação. Abra o link diretamente no navegador.
            </div>
          ) : resolved.mode === "native" ? (
            <video
              key={videoUrl}
              className="w-full max-h-[80vh]"
              controls
              autoPlay
              playsInline
              src={resolved.src}
            />
          ) : (
            <div className="relative aspect-video w-full">
              <iframe
                key={resolved.src}
                title={label || "Vídeo"}
                src={resolved.src}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LandingTestimonialsSection({ data, salesDark, className }: Props) {
  const items = data.items?.filter((it) => it.thumbnail_url.trim() && it.video_url.trim()) ?? [];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!items.length) return null;

  const title = data.title?.trim() || "Testemunhos";
  const subtitle = data.subtitle?.trim() ?? "";

  const active = items[activeIndex];

  return (
    <section className={cn("space-y-8", className)}>
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <h2
          className={cn(
            "text-2xl font-bold tracking-tight md:text-3xl",
            salesDark ? "text-blue-400" : "text-primary",
          )}
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
        {items.map((item, index) => {
          const label = item.name?.trim() || `Testemunho ${index + 1}`;
          return (
            <button
              key={index}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                setOpen(true);
              }}
              className={cn(
                "group relative aspect-[9/16] w-full overflow-hidden rounded-xl text-left shadow-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                salesDark
                  ? "ring-1 ring-white/10 focus-visible:ring-offset-[#050a18]"
                  : "border border-border focus-visible:ring-offset-background",
              )}
              aria-label={`Reproduzir vídeo: ${label}`}
            >
              <img
                src={item.thumbnail_url}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
                aria-hidden
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition group-hover:scale-110",
                  )}
                >
                  <Play className="h-7 w-7 fill-current pl-1" aria-hidden />
                </span>
              </div>
              {item.social_handle?.trim() ? (
                <div className="pointer-events-none absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/95 backdrop-blur-sm">
                  {item.social_handle.trim()}
                </div>
              ) : null}
              {(item.name?.trim() || item.role?.trim()) && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3 pt-8">
                  {item.role?.trim() ? (
                    <p className="text-[10px] font-medium uppercase tracking-wide text-white/75">
                      {item.role.trim()}
                    </p>
                  ) : null}
                  {item.name?.trim() ? (
                    <p className="text-sm font-bold leading-tight text-white">{item.name.trim()}</p>
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {active ? (
        <TestimonialVideoDialog
          key={active.video_url}
          videoUrl={active.video_url}
          open={open}
          onOpenChange={setOpen}
          label={active.name?.trim() || "Vídeo"}
        />
      ) : null}
    </section>
  );
}
