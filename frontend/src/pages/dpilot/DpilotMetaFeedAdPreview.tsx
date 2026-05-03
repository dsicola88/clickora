import { useMemo } from "react";
import { Smartphone, ScanEye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { rsaNextChunk } from "./DpilotGoogleSearchAdPreview";

const PRIMARY_VISIBLE = 180;
const DISPLAY_HEADLINE_MAX = 54;

function headlineFromOffer(offer: string): { text: string; len: number; max: number; truncated: boolean } {
  const base = offer.trim().replace(/\s+/g, " ") || "";
  const { chunk, rest } = rsaNextChunk(base, DISPLAY_HEADLINE_MAX);
  const text = chunk || "Proposta focada na sua audiência.";
  const rawLen = (chunk || "").length || text.length;
  return {
    text,
    len: rawLen,
    max: DISPLAY_HEADLINE_MAX,
    truncated: Boolean(rest.trim()),
  };
}

function displayDomain(landingUrl: string): string {
  const trimmed = landingUrl.trim();
  if (!trimmed) return "seudominio.com";
  try {
    return new URL(trimmed).hostname.replace(/^www\./i, "");
  } catch {
    return "seudominio.com";
  }
}

const PLACEMENT_LABELS: Record<string, string> = {
  facebook_feed: "Facebook feed",
  instagram_feed: "Instagram feed",
  instagram_stories: "Stories",
  instagram_reels: "Reels",
  facebook_reels: "Facebook Reels",
  audience_network: "Audience Network",
  messenger: "Messenger",
};

export type DpilotMetaFeedAdPreviewProps = {
  landingUrl: string;
  offer: string;
  placements: string[];
  assetPreview?: string | null;
  assetIsVideo?: boolean;
  className?: string;
};

/**
 * Feed móvel aproximado (único formato): texto primário truncado ao feed, média opcional,
 * etiquetas de placement escolhidos no assistente.
 */
export function DpilotMetaFeedAdPreview(props: DpilotMetaFeedAdPreviewProps) {
  const offerBody = props.offer.trim().replace(/\s+/g, " ") || "Descreva a oferta no passo anterior.";
  const primaryVisible = offerBody.slice(0, PRIMARY_VISIBLE);
  const primaryTruncated = offerBody.length > PRIMARY_VISIBLE;

  const headline = useMemo(() => headlineFromOffer(props.offer), [props.offer]);

  const domain = useMemo(() => displayDomain(props.landingUrl), [props.landingUrl]);

  const placementBadges = useMemo(() => {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const id of props.placements) {
      const label = PLACEMENT_LABELS[id] ?? id;
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }
    return labels.slice(0, 5);
  }, [props.placements]);

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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/10 dark:bg-indigo-400/15">
            <ScanEye className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Feed Meta
            </p>
            <p className="truncate text-[13px] font-medium text-foreground">Pré-visualização do anúncio</p>
          </div>
        </div>
        <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">
          Referência visual
        </Badge>
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-border/70 bg-muted/35 p-3.5 dark:bg-muted/20">
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Formato celular único · referência
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="h-9 w-9 shrink-0 rounded-full bg-muted ring-2 ring-background" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{domain}</p>
                <p className="text-[11px] text-muted-foreground">
                  Patrocinado<span className="opacity-75"> · </span>
                  {placementBadges[0] ?? "Instagram · Facebook"}
                </p>
              </div>
            </div>

            <p className="text-[15px] leading-snug text-foreground">{primaryVisible.trim()}</p>
            <p className="text-[10px] text-muted-foreground">
              Texto‑primário: ~{PRIMARY_VISIBLE} caracteres visíveis no feed
              {primaryTruncated ? " · texto completo noutros formatos." : "."}
            </p>

            <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
              {props.assetPreview ? (
                props.assetIsVideo ? (
                  <video
                    src={props.assetPreview}
                    className="aspect-square w-full object-cover sm:aspect-video"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={props.assetPreview}
                    alt=""
                    className="aspect-square w-full object-cover sm:aspect-video"
                  />
                )
              ) : (
                <div className="flex aspect-square flex-col justify-end bg-gradient-to-br from-muted to-muted/50 p-3 sm:aspect-video">
                  <span className="text-[11px] font-medium text-muted-foreground">Sem média · passo «Criativo»</span>
                </div>
              )}
              <div className="border-t border-border/50 bg-background px-3 py-2">
                <p className="text-[13px] font-semibold leading-snug text-foreground">{headline.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{domain}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3 py-2">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Saber mais</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {placementBadges.map((l) => (
            <Badge key={l} variant="secondary" className="font-normal capitalize">
              {l}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
