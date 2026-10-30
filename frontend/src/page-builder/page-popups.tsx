import {
  useEffect,
  useState,
  useCallback,
  useId,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PageDocument, PagePopup } from "./types";
import {
  buildOverlayEntranceAnimation,
  overlayCardWidthStyle,
  overlayHostStyle,
  resolveOverlayDisplayMode,
  resolveOverlayPosition,
} from "./overlay-placement";

const SESSION_KEY = "clickora:popup-seen:";

function seenKey(popupId: string) {
  return `${SESSION_KEY}${popupId}`;
}

function wasSeen(popupId: string) {
  try {
    return sessionStorage.getItem(seenKey(popupId)) === "1";
  } catch {
    return false;
  }
}

function markSeen(popupId: string) {
  try {
    sessionStorage.setItem(seenKey(popupId), "1");
  } catch {
    /* ignore */
  }
}

type OpenRequest = { popupId: string };

/** Evento global para abrir popup via interação de widget. */
export const POPUP_OPEN_EVENT = "clickora:open-popup";

export function requestOpenPopup(popupId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OpenRequest>(POPUP_OPEN_EVENT, { detail: { popupId } }));
}

function PopupCard({
  popup,
  onClose,
  animStyle,
}: {
  popup: PagePopup;
  onClose: () => void;
  animStyle?: CSSProperties;
}) {
  const mode = resolveOverlayDisplayMode(popup.displayMode, "modal");
  const position = resolveOverlayPosition(
    popup.position,
    mode === "modal" ? "center" : mode === "bar" ? "bottom" : "bottom-right",
  );
  const maxW = popup.maxWidthPx ?? 480;
  const bg = popup.background?.trim() || "#ffffff";
  const color = popup.textColor?.trim() || "#0f172a";
  const ctaBg = popup.ctaBg?.trim() || "#e63946";
  const ctaColor = popup.ctaColor?.trim() || "#ffffff";
  const href = (popup.ctaHref ?? "").trim();
  const label = (popup.ctaLabel ?? "").trim();
  const radius = Math.max(0, popup.borderRadiusPx ?? (mode === "bar" ? 0 : 16));
  const showClose = popup.showCloseButton !== false;
  const isBar = mode === "bar" || position === "top" || position === "bottom";
  const isSide = position === "left" || position === "right";

  return (
    <div
      role="dialog"
      aria-modal={mode === "modal" ? true : undefined}
      aria-label={popup.title || popup.name}
      style={{
        position: "relative",
        ...overlayCardWidthStyle({ mode, position, maxWidthPx: maxW }),
        maxHeight: isSide ? "100%" : "86vh",
        overflow: "auto",
        background: bg,
        color,
        borderRadius: radius,
        padding: isBar ? "16px 20px" : mode === "toast" ? "18px 16px 16px" : "28px 24px 24px",
        boxShadow:
          mode === "bar"
            ? "0 4px 24px rgba(0,0,0,0.12)"
            : "0 25px 50px -12px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
        ...animStyle,
      }}
    >
      {showClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            border: "none",
            background: "transparent",
            color: "inherit",
            opacity: 0.55,
            cursor: "pointer",
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      ) : null}
      <div
        style={{
          display: isBar ? "flex" : "block",
          alignItems: isBar ? "center" : undefined,
          gap: isBar ? 16 : undefined,
          flexWrap: isBar ? "wrap" : undefined,
          paddingRight: showClose ? 28 : 0,
        }}
      >
        <div style={{ flex: isBar ? "1 1 240px" : undefined }}>
          {popup.title ? (
            <h3
              style={{
                margin: isBar ? "0 0 4px" : "0 0 12px",
                fontSize: mode === "toast" ? 16 : isBar ? 15 : 22,
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {popup.title}
            </h3>
          ) : null}
          {popup.html ? (
            <div
              style={{ fontSize: isBar || mode === "toast" ? 13 : 15, lineHeight: 1.6, opacity: 0.92 }}
              dangerouslySetInnerHTML={{ __html: popup.html }}
            />
          ) : null}
        </div>
        {label && href ? (
          <a
            href={href}
            style={{
              display: "inline-flex",
              flexShrink: 0,
              marginTop: isBar ? 0 : 20,
              padding: "12px 20px",
              borderRadius: 10,
              background: ctaBg,
              color: ctaColor,
              fontWeight: 700,
              textDecoration: "none",
              fontSize: 14,
              alignSelf: isBar ? "center" : undefined,
            }}
          >
            {label}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Runtime de popups da página (público + preview).
 * Disparos: onLoad, onScroll, exitIntent, e manual (via `requestOpenPopup`).
 */
export function PagePopupOverlays({
  doc,
  enabled = true,
}: {
  doc: PageDocument;
  enabled?: boolean;
}) {
  const popups = (doc.popups ?? []).filter((p) => p.enabled !== false);
  const [openId, setOpenId] = useState<string | null>(null);
  const styleId = useId().replace(/:/g, "");

  const tryOpen = useCallback(
    (popup: PagePopup) => {
      if (!enabled) return;
      if (popup.oncePerSession !== false && wasSeen(popup.id)) return;
      setOpenId((cur) => cur ?? popup.id);
    },
    [enabled],
  );

  const close = useCallback(() => {
    if (openId) markSeen(openId);
    setOpenId(null);
  }, [openId]);

  useEffect(() => {
    if (!enabled || popups.length === 0) return;

    const timers: number[] = [];
    const onLoad = popups.filter((p) => p.trigger === "onLoad");
    for (const p of onLoad) {
      const delay = Math.max(0, p.delayMs ?? 0);
      timers.push(window.setTimeout(() => tryOpen(p), delay));
    }

    const onScrollList = popups.filter((p) => p.trigger === "onScroll");
    const onScroll = () => {
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const pct = (window.scrollY / max) * 100;
      for (const p of onScrollList) {
        if (pct >= (p.scrollPercent ?? 40)) tryOpen(p);
      }
    };
    if (onScrollList.length) {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    const exitList = popups.filter((p) => p.trigger === "exitIntent");
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY > 0) return;
      for (const p of exitList) {
        const delay = Math.max(0, p.delayMs ?? 0);
        timers.push(window.setTimeout(() => tryOpen(p), delay));
      }
    };
    if (exitList.length) {
      document.addEventListener("mouseout", onMouseOut);
    }

    const onManual = (ev: Event) => {
      const detail = (ev as CustomEvent<OpenRequest>).detail;
      const target = popups.find((p) => p.id === detail?.popupId);
      if (target) {
        setOpenId(target.id);
      }
    };
    window.addEventListener(POPUP_OPEN_EVENT, onManual);

    return () => {
      timers.forEach((t) => clearTimeout(t));
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener(POPUP_OPEN_EVENT, onManual);
    };
  }, [enabled, popups, tryOpen]);

  if (!enabled || !openId) return null;
  const popup = popups.find((p) => p.id === openId);
  if (!popup) return null;

  const mode = resolveOverlayDisplayMode(popup.displayMode, "modal");
  const position = resolveOverlayPosition(
    popup.position,
    mode === "modal" ? "center" : mode === "bar" ? "bottom" : "bottom-right",
  );
  const backdrop = popup.backdrop !== false && mode === "modal";
  const opacityPct = Math.max(0, Math.min(90, popup.backdropOpacity ?? 55));
  const anim = buildOverlayEntranceAnimation(
    popup.animation ?? "fadeUp",
    popup.animationDurationMs ?? 320,
    popup.animationEasing,
  );

  return (
    <div
      style={overlayHostStyle({
        mode,
        position,
        offsetXPx: popup.offsetXPx,
        offsetYPx: popup.offsetYPx,
        zIndex: popup.zIndex ?? 99990,
        backdrop,
        backdropColor: `rgba(15, 23, 42, ${opacityPct / 100})`,
      })}
      onClick={() => {
        if (backdrop && popup.backdropClose !== false) close();
      }}
    >
      {anim ? <style>{anim.keyframes}</style> : null}
      <div
        data-popup-anim={styleId}
        onClick={(e) => e.stopPropagation()}
        style={{ pointerEvents: "auto" }}
      >
        <PopupCard
          popup={popup}
          onClose={close}
          animStyle={anim ? { animation: anim.animation } : undefined}
        />
      </div>
    </div>
  );
}

/** Contexto mínimo para preview no editor (só renderiza se enabled). */
export function PagePopupHost({
  doc,
  children,
  previewPopups,
}: {
  doc: PageDocument;
  children: ReactNode;
  previewPopups?: boolean;
}) {
  return (
    <>
      {children}
      <PagePopupOverlays doc={doc} enabled={previewPopups !== false} />
    </>
  );
}
