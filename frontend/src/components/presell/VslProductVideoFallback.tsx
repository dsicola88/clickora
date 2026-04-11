import { useEffect, useState } from "react";
import { Play } from "lucide-react";

function presentationLabel(language: string): string {
  const raw = (language || "pt").toLowerCase();
  if (raw === "us" || raw.startsWith("en")) return "Product presentation";
  if (raw.startsWith("es")) return "Presentación del producto";
  return "Apresentação do produto";
}

type Props = {
  images: string[];
  title: string;
  subtitle: string;
  language: string;
  excerpt: string;
  /** Integrado no hero VSL escuro (largura total do contentor). */
  variant?: "default" | "vslHero";
};

/**
 * Quando não há URL de vídeo (YouTube/Vimeo) na importação, simula uma VSL:
 * área 16:9 com imagem(ns) do produto, título e texto por cima.
 */
export function VslProductVideoFallback({
  images,
  title,
  subtitle,
  language,
  excerpt,
  variant = "default",
}: Props) {
  const slides = images.length > 0 ? images : [""];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const n = images.length;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % n), 6000);
    return () => window.clearInterval(t);
  }, [images.length]);

  const shell =
    variant === "vslHero"
      ? "aspect-video w-full rounded-lg sm:rounded-xl overflow-hidden shadow-xl border border-white/10 ring-1 ring-white/5 relative bg-black"
      : "aspect-video max-w-3xl mx-auto rounded-xl overflow-hidden shadow-lg border border-border/50 mt-4 relative bg-black";

  return (
    <div className={shell}>
      {slides.map((src, i) => (
        <div
          key={`slide-${i}`}
          className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
            i === idx ? "opacity-100 z-[1]" : "opacity-0 z-0"
          }`}
        >
          {src ? (
            <img src={src} alt="" className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-950 via-violet-800 to-violet-600" />
          )}
        </div>
      ))}
      <div className="absolute inset-0 z-[2] bg-gradient-to-t from-black/90 via-black/45 to-black/30 pointer-events-none" />
      <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center text-center px-5 sm:px-10 py-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white/95">
          <Play className="h-3.5 w-3.5 shrink-0 fill-white/95 text-white/95" aria-hidden />
          {presentationLabel(language)}
        </div>
        <h2 className="text-xl sm:text-2xl md:text-[1.75rem] font-extrabold text-white leading-tight max-w-2xl drop-shadow-md">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-3 text-sm sm:text-base text-white/92 max-w-xl leading-relaxed drop-shadow">
            {subtitle}
          </p>
        ) : null}
        {excerpt ? (
          <p className="mt-4 text-xs sm:text-sm text-white/80 max-w-lg leading-relaxed line-clamp-5 drop-shadow">
            {excerpt}
          </p>
        ) : null}
      </div>
    </div>
  );
}
