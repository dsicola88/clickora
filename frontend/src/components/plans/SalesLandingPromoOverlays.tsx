import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SalesLandingPromos, SalesPromoPopup } from "@/lib/salesLandingPromos";
import { toast } from "sonner";

type Props = {
  promos: SalesLandingPromos;
  /** Accent fallback from landing theme. */
  accentFallback?: string;
};

const STORAGE = "dclickora:sales-promo:";

function sessionKey(id: string) {
  return `${STORAGE}${id}`;
}

function wasShown(id: string) {
  try {
    return Boolean(sessionStorage.getItem(sessionKey(id)));
  } catch {
    return false;
  }
}

function markShown(id: string) {
  try {
    sessionStorage.setItem(sessionKey(id), "1");
  } catch {
    /* ignore */
  }
}

export function SalesLandingPromoOverlays({ promos, accentFallback = "#38bdf8" }: Props) {
  const [stickyDismissed, setStickyDismissed] = useState(() => wasShown("sticky_bar"));
  const [activePopup, setActivePopup] = useState<SalesPromoPopup | null>(null);

  const openPopup = useCallback((p: SalesPromoPopup) => {
    if (p.once_per_session && wasShown(p.id)) return;
    setActivePopup(p);
    if (p.once_per_session) markShown(p.id);
  }, []);

  const exitPopup = useMemo(
    () => promos.popups.find((p) => p.enabled && p.trigger === "exit_intent") ?? null,
    [promos.popups],
  );
  const timedPopups = useMemo(
    () => promos.popups.filter((p) => p.enabled && p.trigger === "timed"),
    [promos.popups],
  );
  const scrollPopups = useMemo(
    () => promos.popups.filter((p) => p.enabled && p.trigger === "scroll"),
    [promos.popups],
  );

  useEffect(() => {
    if (!exitPopup || activePopup) return;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY > 20) return;
      openPopup(exitPopup);
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [exitPopup, activePopup, openPopup]);

  useEffect(() => {
    if (!timedPopups.length || activePopup) return;
    const timers = timedPopups.map((p) =>
      window.setTimeout(() => {
        if (!activePopup) openPopup(p);
      }, Math.max(0, p.delay_ms)),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [timedPopups, activePopup, openPopup]);

  useEffect(() => {
    if (!scrollPopups.length || activePopup) return;
    const fired = new Set<string>();
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 0;
      for (const p of scrollPopups) {
        if (fired.has(p.id)) continue;
        if (pct >= p.scroll_percent) {
          fired.add(p.id);
          openPopup(p);
          break;
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollPopups, activePopup, openPopup]);

  const sticky = promos.sticky_bar;
  const showSticky = sticky.enabled && !stickyDismissed && Boolean(sticky.text?.trim());

  const accent = activePopup?.accent?.trim() || accentFallback;

  return (
    <>
      {showSticky ? (
        <div
          className="relative z-[60] flex w-full items-center justify-center gap-3 px-3 py-2.5 text-center text-sm font-medium shadow-sm"
          style={{
            background: sticky.background?.trim() || accentFallback,
            color: sticky.text_color?.trim() || "#0b1220",
          }}
          role="region"
          aria-label="Promoção"
        >
          <p className="min-w-0 flex-1 leading-snug">
            {sticky.text}
            {sticky.discount_code?.trim() ? (
              <span className="ml-2 inline-flex items-center rounded-md bg-black/15 px-2 py-0.5 font-mono text-xs tracking-wide">
                {sticky.discount_code.trim()}
              </span>
            ) : null}
          </p>
          {sticky.cta_label?.trim() ? (
            <a
              href={sticky.cta_href?.trim() || "#planos"}
              className="shrink-0 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-black/30"
            >
              {sticky.cta_label.trim()}
            </a>
          ) : null}
          {sticky.dismissible ? (
            <button
              type="button"
              className="shrink-0 rounded-full p-1 hover:bg-black/15"
              aria-label="Fechar promoção"
              onClick={() => {
                setStickyDismissed(true);
                markShown("sticky_bar");
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {activePopup ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sales-promo-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActivePopup(null);
          }}
        >
          <div
            className={cn(
              "relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] p-6 text-white shadow-2xl",
              "animate-in fade-in zoom-in-95 duration-200",
            )}
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-40 blur-3xl"
              style={{ background: accent }}
            />
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
              onClick={() => setActivePopup(null)}
            >
              <X className="h-4 w-4" />
            </button>

            {activePopup.badge?.trim() ? (
              <span
                className="mb-3 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#0b1220]"
                style={{ background: accent }}
              >
                {activePopup.badge.trim()}
              </span>
            ) : null}

            <h2 id="sales-promo-title" className="pr-8 text-xl font-bold leading-tight tracking-tight">
              {activePopup.title}
            </h2>
            {activePopup.body?.trim() ? (
              <p className="mt-2 text-sm leading-relaxed text-white/70">{activePopup.body}</p>
            ) : null}

            {activePopup.discount_code?.trim() ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5">
                <code className="flex-1 font-mono text-sm tracking-widest text-white">
                  {activePopup.discount_code.trim()}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    void navigator.clipboard?.writeText(activePopup.discount_code!.trim()).then(
                      () => toast.success("Código copiado"),
                      () => toast.error("Não foi possível copiar"),
                    );
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
            ) : null}
            {activePopup.discount_hint?.trim() ? (
              <p className="mt-2 text-xs text-white/45">{activePopup.discount_hint}</p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                className="h-11 flex-1 border-0 font-semibold text-[#0b1220] hover:opacity-95"
                style={{ background: accent }}
                asChild
              >
                <a href={activePopup.cta_href || "#planos"} onClick={() => setActivePopup(null)}>
                  {activePopup.cta_label || "Continuar"}
                </a>
              </Button>
              {activePopup.secondary_label?.trim() ? (
                activePopup.secondary_href?.trim() ? (
                  <Button
                    variant="outline"
                    className="h-11 flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
                    asChild
                  >
                    <a href={activePopup.secondary_href} onClick={() => setActivePopup(null)}>
                      {activePopup.secondary_label.trim()}
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="h-11 flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
                    onClick={() => setActivePopup(null)}
                  >
                    {activePopup.secondary_label.trim()}
                  </Button>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
