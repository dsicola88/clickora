import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PublishReadinessItem = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
};

type Props = {
  items: PublishReadinessItem[];
  className?: string;
};

/**
 * Checklist import → publish (Fase 1 presell): domínio, CTA tracked, status.
 */
export function PresellPublishReadiness({ items, className }: Props) {
  if (!items.length) return null;
  const done = items.filter((i) => i.ok).length;
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-4 space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Pronta a anunciar</h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {done}/{items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            {item.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            )}
            <span className={cn(item.ok && "text-muted-foreground")}>
              {item.label}
              {!item.ok && item.hint ? (
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.hint}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Heurística partilhada: hoplink + track path no HTML espelhado. */
export function buildPublishReadinessFromPresell(input: {
  status?: string | null;
  affiliateLink?: string | null;
  mirrorHtml?: string | null;
  customDomainId?: string | null;
  publicUrl?: string | null;
}): PublishReadinessItem[] {
  const link = (input.affiliateLink || "").trim();
  const html = input.mirrorHtml || "";
  const hasTrack =
    /\/api\/track\/r\//i.test(html) ||
    /clickora_click_id|\/track\/r\//i.test(html) ||
    Boolean(link);
  return [
    {
      id: "published",
      label: "Presell publicada",
      ok: input.status === "published",
      hint: "Mude o estado para Publicada antes de anunciar.",
    },
    {
      id: "offer",
      label: "Hoplink / oferta definido",
      ok: /^https?:\/\//i.test(link),
      hint: "Cole o URL da rede (BuyGoods, MaxWeb, Digistore…).",
    },
    {
      id: "cta_track",
      label: "CTAs com tracking",
      ok: hasTrack,
      hint: "Os botões devem passar por /api/track/r/ com o click id.",
    },
    {
      id: "domain",
      label: "URL pública / domínio",
      ok: Boolean(input.customDomainId || (input.publicUrl && /^https?:\/\//i.test(input.publicUrl))),
      hint: "Ligue um domínio verificado ou use o link público da app.",
    },
  ];
}
