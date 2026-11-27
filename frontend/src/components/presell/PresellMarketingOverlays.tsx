import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { mergeLandingAdParamsIntoTrackHref } from "@/lib/presellTrackAdParams";

type Lang = string;

function stringsFor(lang: Lang) {
  const pt = {
    exitTitle: "Espera — não percas esta oferta",
    exitBody: "Continua para ver a oferta.",
    exitCta: "Ir para a oferta",
    exitDismiss: "Fechar",
  };
  const en = {
    exitTitle: "Wait — don’t miss this offer",
    exitBody: "Continue to see the offer.",
    exitCta: "Go to the offer",
    exitDismiss: "Close",
  };
  const es = {
    exitTitle: "Espera — no te pierdas esta oferta",
    exitBody: "Continúa para ver la oferta.",
    exitCta: "Ir a la oferta",
    exitDismiss: "Cerrar",
  };
  const de = {
    exitTitle: "Warte — verpass dieses Angebot nicht",
    exitBody: "Weiter, um das Angebot zu sehen.",
    exitCta: "Zum Angebot",
    exitDismiss: "Schließen",
  };
  const fr = {
    exitTitle: "Attends — ne rate pas cette offre",
    exitBody: "Continue pour voir l’offre.",
    exitCta: "Voir l’offre",
    exitDismiss: "Fermer",
  };
  const it = {
    exitTitle: "Aspetta — non perdere questa offerta",
    exitBody: "Continua per vedere l’offerta.",
    exitCta: "Vai all’offerta",
    exitDismiss: "Chiudi",
  };
  const code = String(lang || "").toLowerCase();
  if (code.startsWith("pt")) return pt;
  if (code.startsWith("es")) return es;
  if (code.startsWith("de")) return de;
  if (code.startsWith("fr")) return fr;
  if (code.startsWith("it")) return it;
  return en;
}

type Props = {
  /** ID da presell (único por página — isolamento multi-tenant). */
  pageId: string;
  settings: Record<string, unknown>;
  /** URL de clique rastreado (Clickora). */
  trackHref: string;
  language: Lang;
  /**
   * Quando o modal de cookies está activo, não mostrar o popup de saída:
   * tapava o consentimento e criava um «segundo fluxo».
   */
  suppressWhileCookieGate?: boolean;
};

/**
 * Popup de saída (toggle `settings.exitPopup` desta presell).
 * «Fechar» e o fundo só fecham; a oferta abre apenas pelo CTA (link nativo para /track/r/).
 * `countdownTimer` / `socialProof` legados não são renderizados: contador que reinicia por sessão
 * e compras inventadas são práticas enganosas nas políticas de anúncios.
 */
export function PresellMarketingOverlays({
  pageId,
  settings,
  trackHref,
  language,
  suppressWhileCookieGate = false,
}: Props) {
  const exitOn = Boolean(settings.exitPopup);
  const str = useMemo(() => stringsFor(language), [language]);
  const storageKey = `clickora:mt:${pageId}:exit-shown`;
  const [exitOpen, setExitOpen] = useState(false);

  useEffect(() => {
    if (suppressWhileCookieGate || !exitOn || !trackHref) return;
    if (sessionStorage.getItem(storageKey)) return;

    const onLeave = (e: MouseEvent) => {
      if (e.clientY > 24) return;
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
      setExitOpen(true);
    };

    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => document.documentElement.removeEventListener("mouseleave", onLeave);
  }, [suppressWhileCookieGate, exitOn, trackHref, storageKey]);

  if (suppressWhileCookieGate || !exitOn || !exitOpen || !trackHref) return null;

  const offerHref =
    (typeof window !== "undefined" && mergeLandingAdParamsIntoTrackHref(trackHref, window.location.search)) ||
    trackHref;
  const close = () => setExitOpen(false);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="presell-exit-title"
      data-testid="presell-exit-sheet"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
        aria-label={str.exitDismiss}
        data-testid="presell-exit-backdrop"
        onClick={close}
      />
      <div className="relative z-10 max-w-md w-full rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
        <h2 id="presell-exit-title" className="text-lg font-semibold text-card-foreground">
          {str.exitTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{str.exitBody}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={close} data-testid="presell-exit-close">
            {str.exitDismiss}
          </Button>
          <Button asChild>
            <a href={offerHref} data-testid="presell-exit-cta">
              {str.exitCta}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
