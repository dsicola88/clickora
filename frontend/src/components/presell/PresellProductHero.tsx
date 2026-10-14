import { useEffect, useMemo, useState } from "react";
import { presellImageDisplayCandidates } from "@/lib/presellImageDisplay";
import { cn } from "@/lib/utils";

/** Imagem de apoio (galeria ou miniatura). Lazy, com fallback para o URL original. */
export function PresellSecondaryImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const candidates = useMemo(() => presellImageDisplayCandidates(src), [src]);
  const [step, setStep] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setStep(0);
    setHidden(false);
  }, [src]);

  const current = candidates[step] ?? "";
  if (hidden || !current) return null;

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => {
        console.warn("[presell] falha ao carregar imagem secundária", current);
        if (step + 1 < candidates.length) {
          setStep((n) => n + 1);
          return;
        }
        setHidden(true);
      }}
    />
  );
}

type Tone = "dark" | "tint" | "light" | "plain";
type Emphasis = "primary" | "support" | "showcase";

type Props = {
  src: string;
  alt: string;
  /** Chamado só depois de esgotar o rendition maior e o URL original. */
  onError?: () => void;
  tone?: Tone;
  /** `primary` = produto em destaque. `support` = imagem de apoio (ex.: VSL com vídeo). */
  emphasis?: Emphasis;
};

/**
 * Palco do produto: reserva altura real e pede o ficheiro maior quando o URL é um thumbnail.
 * Não substitui a foto por uma imagem genérica.
 */
export function PresellProductHero({
  src,
  alt,
  onError,
  tone = "light",
  emphasis = "primary",
}: Props) {
  const candidates = useMemo(() => presellImageDisplayCandidates(src), [src]);
  const [step, setStep] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setStep(0);
    setExhausted(false);
  }, [src]);

  const current = candidates[step] ?? "";

  const handleError = () => {
    console.warn("[presell] falha ao carregar imagem", { src: current || src, step });
    if (step + 1 < candidates.length) {
      setStep((n) => n + 1);
      return;
    }
    setExhausted(true);
    onError?.();
  };

  const stageClass = cn(
    "presell-product-stage relative w-full overflow-hidden rounded-xl",
    emphasis === "showcase" && "min-h-[220px] sm:min-h-[min(46vh,520px)] bg-transparent",
    emphasis === "primary" && "min-h-[min(58vh,640px)]",
    emphasis === "support" && "min-h-[min(36vh,380px)]",
    emphasis !== "showcase" && tone === "dark" && "bg-black/30",
    emphasis !== "showcase" && tone === "tint" && "bg-white/50",
    emphasis !== "showcase" && tone === "light" && "bg-white dark:bg-muted/25",
    emphasis !== "showcase" && tone === "plain" && "bg-white/70 dark:bg-card/40",
  );

  if (!src || (exhausted && step >= candidates.length - 1 && !current)) {
    return (
      <div data-presell-hero="unavailable" className={cn(stageClass, "flex items-center justify-center px-4")}>
        <p className="text-center text-sm font-medium text-muted-foreground">{alt}</p>
      </div>
    );
  }

  if (exhausted) {
    return (
      <div data-presell-hero="unavailable" className={cn(stageClass, "flex items-center justify-center px-4")}>
        <p className="max-w-sm text-center text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-200">
          {alt}
        </p>
      </div>
    );
  }

  return (
    <div data-presell-hero="product" data-presell-hero-emphasis={emphasis} className={stageClass}>
      <img
        src={current}
        alt={alt}
        onError={handleError}
        onLoad={(e) => {
          const img = e.currentTarget;
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const paymentStrip = h > 0 && w / h >= 3.4 && h < 240;
          const tinyIcon = w > 0 && w < 140 && h < 140;
          const smallTile = w > 0 && w <= 520 && h <= 520;
          if (paymentStrip || tinyIcon || smallTile) {
            handleError();
            return;
          }
          if (w > 0 && w < 280) {
            console.warn("[presell] imagem principal com resolução baixa", {
              src: current,
              width: w,
              height: h,
            });
          }
        }}
        className="absolute inset-0 h-full w-full object-contain object-center"
        loading="eager"
        decoding="async"
        ref={(node) => {
          node?.setAttribute("fetchpriority", emphasis === "support" ? "auto" : "high");
        }}
        sizes={emphasis === "primary" ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 768px) 42rem, 100vw"}
      />
    </div>
  );
}
