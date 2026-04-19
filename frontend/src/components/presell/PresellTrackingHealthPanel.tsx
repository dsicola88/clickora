import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Info, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  computePresellTrackingHealth,
  PRESELL_QA_UTM,
  type TrackingHealthItem,
} from "@/lib/presellTrackingHealth";
import type { PresellConfigSettings } from "@/lib/presellConfigDefaults";
import { cn } from "@/lib/utils";

type Props = {
  configSettings: PresellConfigSettings;
  trackingEmbedScript: string;
  affiliateLink: string;
  publishedPageId?: string | null;
  publicPageUrl?: string | null;
  isEditor?: boolean;
  /** No editor manual: permite ocultar o painel inteiro (mais espaço para o canvas). */
  onRequestHide?: () => void;
};

function StatusIcon({ status }: { status: TrackingHealthItem["status"] }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />;
  if (status === "warn") return <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />;
  return <Info className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />;
}

/**
 * Checklist de prontidão do rastreamento — dados só desta presell (multi-tenant).
 */
export function PresellTrackingHealthPanel({
  configSettings,
  trackingEmbedScript,
  affiliateLink,
  publishedPageId,
  publicPageUrl,
  isEditor,
  onRequestHide,
}: Props) {
  const { items, readyScore } = useMemo(
    () =>
      computePresellTrackingHealth({
        configSettings,
        hasTrackingEmbedScript: Boolean(trackingEmbedScript?.trim()),
        affiliateLinkTrimmed: affiliateLink.trim(),
        hasPublishedPageId: Boolean(publishedPageId),
      }),
    [configSettings, trackingEmbedScript, affiliateLink, publishedPageId],
  );

  const testUrl = useMemo(() => {
    if (!publicPageUrl?.trim()) return null;
    const base = publicPageUrl.trim();
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}${PRESELL_QA_UTM}`;
  }, [publicPageUrl]);

  return (
    <div
      className={cn(
        "rounded-xl border space-y-2.5 sm:space-y-3",
        isEditor ? "border-editor-accent/30 bg-editor-panel-2/80 p-2.5 sm:p-3" : "border-primary/20 bg-card/80 p-3 sm:p-4",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className={cn("text-sm font-semibold", isEditor ? "text-editor-fg" : "text-foreground")}>
            Saúde do rastreamento
          </h3>
          <p className={cn("text-[11px] mt-0.5", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
            Checklist antes de escalar tráfego pago — específico desta página.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isEditor && onRequestHide ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[11px] text-editor-fg-muted hover:text-editor-fg"
              onClick={onRequestHide}
            >
              Ocultar
            </Button>
          ) : null}
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold tabular-nums sm:h-10 sm:w-10 sm:text-sm",
              readyScore >= 80
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : readyScore >= 55
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-slate-500/15 text-slate-600 dark:text-slate-400",
            )}
            title="Pontuação indicativa"
          >
            {readyScore}
          </div>
        </div>
      </div>

      <ul className={cn("space-y-1.5 sm:space-y-2", isEditor && "max-h-[min(28vh,11rem)] overflow-y-auto pr-0.5 editor-scrollbar")}>
        {items.map((it) => (
          <li key={it.id} className="flex gap-2 text-left">
            <span className="mt-0.5">
              <StatusIcon status={it.status} />
            </span>
            <div className="min-w-0">
              <p className={cn("text-xs font-medium leading-snug", isEditor ? "text-editor-fg" : "text-foreground")}>
                {it.label}
              </p>
              {it.detail ? (
                <p className={cn("text-[11px] leading-relaxed mt-0.5", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
                  {it.detail}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {testUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1 border-t border-dashed border-border/50">
          <span className={cn("text-[11px]", isEditor ? "text-editor-fg-muted" : "text-muted-foreground")}>
            Pré-visualização com UTMs de teste (não substitui testes nas redes).
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "gap-1.5 shrink-0",
              isEditor && "border-editor-border bg-editor-panel text-editor-fg hover:bg-editor-border/80",
            )}
            asChild
          >
            <a href={testUrl} target="_blank" rel="noopener noreferrer">
              <Link2 className="h-3.5 w-3.5" />
              Abrir página de teste
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
