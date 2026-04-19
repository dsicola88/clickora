import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Lang = string;

function stringsFor(lang: Lang) {
  const pt = {
    exitTitle: "Espera — não percas esta oferta",
    exitBody: "Clica abaixo para aceder ao link com rastreamento.",
    exitCta: "Ir para a oferta",
    exitDismiss: "Continuar na página",
    countdownLabel: "Tempo restante",
    socialBought: "comprou há pouco",
    socialFrom: "de",
  };
  const en = {
    exitTitle: "Wait — don’t miss this offer",
    exitBody: "Click below to open the tracked link.",
    exitCta: "Go to the offer",
    exitDismiss: "Stay on this page",
    countdownLabel: "Time left",
    socialBought: "purchased recently",
    socialFrom: "from",
  };
  return String(lang || "").toLowerCase().startsWith("en") ? en : pt;
}

const SOCIAL_NAMES = [
  "Maria",
  "João",
  "Ana",
  "Pedro",
  "Sofia",
  "Lucas",
  "Inês",
  "Miguel",
];
const SOCIAL_CITIES = [
  "Lisboa",
  "Porto",
  "Braga",
  "Coimbra",
  "Faro",
  "Aveiro",
  "London",
  "Madrid",
];

function randomSocialLine(lang: Lang): string {
  const s = stringsFor(lang);
  const n = SOCIAL_NAMES[Math.floor(Math.random() * SOCIAL_NAMES.length)];
  const c = SOCIAL_CITIES[Math.floor(Math.random() * SOCIAL_CITIES.length)];
  return `${n} ${s.socialBought} — ${s.socialFrom} ${c}`;
}

type Props = {
  /** ID da presell (único por página — isolamento multi-tenant). */
  pageId: string;
  settings: Record<string, unknown>;
  /** URL de clique rastreado (Clickora). */
  trackHref: string;
  language: Lang;
};

/**
 * Popup de saída, contagem regressiva e notificações de «prova social»,
 * ligados aos toggles em `settings` desta presell apenas.
 */
export function PresellMarketingOverlays({ pageId, settings, trackHref, language }: Props) {
  const exitOn = Boolean(settings.exitPopup);
  const countdownOn = Boolean(settings.countdownTimer);
  const socialOn = Boolean(settings.socialProof);

  const durationMin = useMemo(() => {
    const raw = Number(settings.countdownDurationMinutes ?? 15);
    if (!Number.isFinite(raw) || raw < 1) return 15;
    return Math.min(24 * 60, Math.max(1, Math.floor(raw)));
  }, [settings.countdownDurationMinutes]);

  const str = useMemo(() => stringsFor(language), [language]);

  const storagePrefix = `clickora:mt:${pageId}:`;

  /* ---------- Exit intent ---------- */
  const [exitOpen, setExitOpen] = useState(false);

  useEffect(() => {
    if (!exitOn || !trackHref) return;
    const k = `${storagePrefix}exit-shown`;
    if (sessionStorage.getItem(k)) return;

    const onLeave = (e: MouseEvent) => {
      if (e.clientY > 24) return;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
      setExitOpen(true);
    };

    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => document.documentElement.removeEventListener("mouseleave", onLeave);
  }, [exitOn, trackHref, storagePrefix]);

  /* ---------- Countdown ---------- */
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!countdownOn) {
      setSecondsLeft(null);
      return;
    }
    const endKey = `${storagePrefix}cd-end`;
    const now = Date.now();
    let end = Number(sessionStorage.getItem(endKey));
    if (!end || end < now) {
      end = now + durationMin * 60 * 1000;
      sessionStorage.setItem(endKey, String(end));
    }
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft(s);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [countdownOn, durationMin, storagePrefix]);

  const countdownLabel = useMemo(() => {
    if (secondsLeft == null) return "";
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [secondsLeft]);

  /* ---------- Social proof toasts ---------- */
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!socialOn) return;
    const showAndHide = () => {
      setToast(randomSocialLine(language));
      window.setTimeout(() => setToast(null), 6500);
    };
    const t1 = window.setTimeout(showAndHide, 4000 + Math.random() * 3000);
    const interval = window.setInterval(showAndHide, 12000 + Math.random() * 8000);
    return () => {
      window.clearTimeout(t1);
      window.clearInterval(interval);
    };
  }, [socialOn, language]);

  const goOffer = useCallback(() => {
    if (trackHref) window.location.assign(trackHref);
  }, [trackHref]);

  if (!exitOn && !countdownOn && !socialOn) return null;

  return (
    <>
      {exitOpen && exitOn ? (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="presell-exit-title"
        >
          <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h2 id="presell-exit-title" className="text-lg font-semibold text-card-foreground">
              {str.exitTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{str.exitBody}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setExitOpen(false)}>
                {str.exitDismiss}
              </Button>
              <Button type="button" onClick={goOffer}>
                {str.exitCta}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {countdownOn && secondsLeft != null && secondsLeft > 0 ? (
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-[400] flex items-center justify-center gap-3 border-t border-border",
            "bg-gradient-to-r from-primary/90 to-primary px-4 py-2.5 text-primary-foreground shadow-lg",
          )}
        >
          <span className="text-xs font-medium uppercase tracking-wide opacity-90">
            {str.countdownLabel}
          </span>
          <span className="font-mono text-lg font-bold tabular-nums">{countdownLabel}</span>
        </div>
      ) : null}

      {socialOn && toast ? (
        <div
          className="fixed bottom-20 left-4 z-[390] max-w-sm animate-in fade-in slide-in-from-bottom-4 sm:left-8"
          role="status"
        >
          <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 shadow-lg">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
            <p className="text-sm text-card-foreground">{toast}</p>
            <button
              type="button"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => setToast(null)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
