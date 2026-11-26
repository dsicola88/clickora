import { CheckCircle2, Circle } from "lucide-react";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { hrefLooksLikeOfferLink } from "@/lib/presellOfferHrefBake";
import { cn } from "@/lib/utils";
import type { PageDocument } from "@/page-builder/types";

export type PublishReadinessItem = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
  /** Bloqueia publicar enquanto `ok` for falso (sem onde servir a página). */
  blocking?: boolean;
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

function isTrackHref(href: string): boolean {
  return /\/api\/track\/r\//i.test(href) || /\/track\/r\//i.test(href);
}

/** Conta hrefs comerciais no HTML que ainda não passam por /track/r/. */
export function countUntrackedOfferHrefs(html: string, affiliateHref = ""): number {
  if (!html) return 0;
  let n = 0;
  const re = /href\s*=\s*(["'])(.*?)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = (m[2] || "").trim();
    if (!href || isTrackHref(href)) continue;
    if (hrefLooksLikeOfferLink(href, affiliateHref)) n += 1;
  }
  return n;
}

/** HTML relevante para gate de CTAs (espelho + blocos do page builder). */
export function collectOfferTrackingHtmlFromContent(content: Record<string, unknown>): string {
  const parts: string[] = [];
  const mirror = content.importMirrorSrcDoc ?? content.import_mirror_src_doc;
  if (typeof mirror === "string" && mirror.length > 0) parts.push(mirror);
  const doc =
    parsePresellBuilderPageDocument(content) ||
    (content.pageDocument as PageDocument | undefined) ||
    (content.page_document as PageDocument | undefined);
  if (doc && Array.isArray(doc.sections)) {
    for (const section of doc.sections) {
      for (const column of section.columns) {
        for (const widget of column.widgets) {
          if (widget.type === "html" && typeof widget.content.code === "string") {
            parts.push(widget.content.code);
          }
          if (widget.type === "button" && typeof widget.content.href === "string") {
            const href = widget.content.href.trim();
            if (href && href !== "#") {
              parts.push(`<a href="${href.replace(/"/g, "&quot;")}">cta</a>`);
            }
          }
        }
      }
    }
  }
  return parts.join("\n");
}

/** Hoplink efectivo: content.affiliateLink ou tracking.offerUrl (wizard antigo). */
export function resolvePresellAffiliateLink(page: {
  content?: Record<string, unknown> | null;
  tracking?: Record<string, unknown> | null;
}): string {
  const content = (page.content || {}) as Record<string, unknown>;
  const tracking = (page.tracking || {}) as Record<string, unknown>;
  const fromContent = String(content.affiliateLink ?? content.affiliate_link ?? "").trim();
  if (fromContent) return fromContent;
  return String(tracking.offerUrl ?? tracking.offer_url ?? "").trim();
}

/** Heurística partilhada: hoplink + CTAs baked no HTML espelhado. */
export function buildPublishReadinessFromPresell(input: {
  status?: string | null;
  affiliateLink?: string | null;
  mirrorHtml?: string | null;
  content?: Record<string, unknown> | null;
  customDomainId?: string | null;
  publicUrl?: string | null;
  /** Domínio Vercel ainda sem HTTPS pronto — não use em Final URL. */
  customDomainHttpsPending?: boolean;
}): PublishReadinessItem[] {
  const link = (input.affiliateLink || "").trim();
  const html =
    input.mirrorHtml ||
    (input.content ? collectOfferTrackingHtmlFromContent(input.content) : "");
  const hasTrackMarker =
    /\/api\/track\/r\//i.test(html) ||
    /clickora_click_id|\/track\/r\//i.test(html);
  const untracked = countUntrackedOfferHrefs(html, link);
  /** Hoplink + zero CTAs comerciais crus (bake no save / wizard). */
  const ctaOk = Boolean(link) && (!html || untracked === 0);
  const hasPublicUrl = Boolean(input.publicUrl && /^https?:\/\//i.test(input.publicUrl));
  const domainOk = !input.customDomainHttpsPending && Boolean(input.customDomainId || hasPublicUrl);
  /** Sem domínio próprio e sem domínio técnico isolado: o domínio principal não serve presells. */
  const noPublicHost = !input.customDomainId && !hasPublicUrl;
  return [
    {
      id: "published",
      label: "Presell publicada",
      ok: input.status === "published",
      hint: "Mude o estado para Publicada antes de anunciar.",
    },
    {
      id: "offer",
      label: "Link da oferta definido",
      ok: /^https?:\/\//i.test(link),
      hint: "Cole o URL da rede (BuyGoods, MaxWeb, Digistore…).",
    },
    {
      id: "cta_track",
      label: "Botões com rastreamento",
      ok: ctaOk,
      hint:
        untracked > 0
          ? `${untracked} link(s) da oferta ainda sem rastreamento — guarde a página para ligar automaticamente.`
          : hasTrackMarker
            ? undefined
            : "Os botões de compra devem passar pelo rastreamento Clickora (com o ID do clique).",
    },
    {
      id: "domain",
      label: "URL pública / domínio",
      ok: domainOk,
      blocking: noPublicHost,
      hint: input.customDomainHttpsPending
        ? "O domínio ainda não está pronto — aguarde «Pronto para anúncios» antes de usar na Final URL."
        : "Conecte um domínio próprio verificado para publicar. O domínio principal da plataforma não serve presells públicas.",
    },
  ];
}

/** Bloqueia «publicar / anunciar» se oferta ou CTAs falharem (gates duros). */
export function publishBlockedByReadiness(items: PublishReadinessItem[]): PublishReadinessItem | null {
  const hard = new Set(["offer", "cta_track"]);
  return items.find((i) => (hard.has(i.id) || i.blocking) && !i.ok) ?? null;
}
