import { useMemo } from "react";
import { Smartphone, TvMinimal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PRIMARY_VISIBLE = 100;

function displayDomain(landingUrl: string): string {
  const trimmed = landingUrl.trim();
  if (!trimmed) return "seudominio.com";
  try {
    return new URL(trimmed).hostname.replace(/^www\./i, "");
  } catch {
    return "seudominio.com";
  }
}

const OBJECTIVE_SHORT: Record<string, string> = {
  traffic: "Tráfego",
  reach: "Alcance",
  video_views: "Vídeo",
  leads: "Leads",
  conversions: "Conversões",
  app_installs: "App",
};

export type DpilotTiktokInFeedPreviewProps = {
  landingUrl: string;
  offer: string;
  objectiveId: string;
  mediaPreview?: string | null;
  mediaIsVideo?: boolean;
  className?: string;
};

/** Pré-visualização vertical simples ao estilo For You — referência para copy e média antes do envio ao plano. */
export function DpilotTiktokInFeedPreview(props: DpilotTiktokInFeedPreviewProps) {
  const body =
    props.offer.trim().replace(/\s+/g, " ") ||
    "Indique destino e oferta para ver o texto alinhado ao formato vertical.";
  const primary = body.slice(0, PRIMARY_VISIBLE);
  const truncated = body.length > PRIMARY_VISIBLE;
  const domain = useMemo(() => displayDomain(props.landingUrl), [props.landingUrl]);
  const objLabel = OBJECTIVE_SHORT[props.objectiveId] ?? props.objectiveId;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-background/95 shadow-md",
        "ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        props.className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-950/10 dark:bg-white/10">
            <TvMinimal className="h-4 w-4 text-neutral-900 dark:text-neutral-100" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              TikTok · For You
            </p>
            <p className="truncate text-[13px] font-medium text-foreground">Referência vertical</p>
          </div>
        </div>
        <Badge variant="secondary" className="hidden shrink-0 text-[10px] sm:inline-flex">
          {objLabel}
        </Badge>
      </div>

      <div className="p-4">
        <div className="relative mx-auto w-full max-w-[220px]">
          <div className="aspect-[9/16] overflow-hidden rounded-2xl border border-border bg-black shadow-inner">
            {props.mediaPreview ? (
              props.mediaIsVideo ? (
                <video
                  src={props.mediaPreview}
                  className="h-full w-full object-cover object-center"
                  muted
                  playsInline
                />
              ) : (
                <img src={props.mediaPreview} alt="" className="h-full w-full object-cover object-center" />
              )
            ) : (
              <div className="flex h-full flex-col justify-center bg-gradient-to-b from-muted/80 via-muted to-neutral-950/85 px-3 text-center">
                <Smartphone className="mx-auto h-10 w-10 text-muted-foreground/70" aria-hidden />
                <p className="mt-3 px-2 text-[11px] leading-snug text-muted-foreground">
                  Carregue imagem ou vídeo no passo «Criativo».
                </p>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black/95 via-black/55 to-transparent p-4 pt-16 text-white">
              <div className="flex items-start gap-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-white/20 ring-2 ring-white/30 backdrop-blur-sm" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold leading-tight">{domain}</p>
                  <p className="text-[11px] text-white/80">Patrocinado</p>
                </div>
              </div>
              <p className="text-[14px] font-medium leading-snug drop-shadow">{primary.trim()}</p>
              {truncated ? <p className="text-[10px] text-white/65">··· ~{PRIMARY_VISIBLE} caracteres neste formato</p> : null}
              <span className="inline-block rounded border border-white/40 bg-white/15 px-3 py-1.5 text-[12px] font-semibold">
                Saber mais
              </span>
            </div>
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-[220px] text-center text-[10px] leading-relaxed text-muted-foreground">
          Proporções e clipes na rede podem diferir da pré-visualização.
        </p>
      </div>
    </div>
  );
}
