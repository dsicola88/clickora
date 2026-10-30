import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { useBuilderSurface } from "../builder-surface";
import { cookieBannerLocksPage, cookieBannerUsesPageOverlay } from "../cookieBannerOverlay";
import {
  clampCookieOverlayBlur,
  clampCookieOverlayOpacity,
  resolveCookieBannerCopy,
} from "../cookieBannerCopy";
import {
  buildOverlayEntranceAnimation,
  overlayCardWidthStyle,
  overlayHostStyle,
  resolveOverlayPosition,
  type OverlayAnimation,
  type OverlayPosition,
} from "../overlay-placement";
import { usePresellPublicLocale } from "@/lib/presellPublicLocale";
import { useInlineEdit } from "../inline-edit";

export interface CookieBannerContent {
  title: string;
  body: string;
  allowLabel: string;
  declineLabel: string;
  policyLabel: string;
  policyUrl: string;
  footerNote?: string;
  accentColor: string;
  /** modal = overlay centrado; corner = canto; bar = faixa top/bottom */
  variant: "modal" | "corner" | "bar";
  position:
    | "center"
    | "top"
    | "bottom"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  storageKey: string;
  /** Escurece/blur o fundo no modo modal */
  backdrop: boolean;
  overlayOpacity?: number;
  overlayBlur?: number;
  followLanguage?: boolean;
  offerHref?: string;
  animation?: OverlayAnimation;
  animationDurationMs?: number;
  delayMs?: number;
  maxWidthPx?: number;
  offsetXPx?: number;
  offsetYPx?: number;
  showCloseButton?: boolean;
}

function readDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

function CookieText({
  field,
  value,
  style,
}: {
  field: string;
  value: string;
  style?: CSSProperties;
}) {
  const commit = useInlineEdit();
  if (!commit) return <span style={style}>{value}</span>;
  return (
    <span
      style={style}
      contentEditable
      suppressContentEditableWarning
      onMouseDown={(event) => event.stopPropagation()}
      onBlur={(event) => {
        const next = event.currentTarget.textContent ?? "";
        if (next !== value) commit({ [field]: next, followLanguage: false });
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    >
      {value}
    </span>
  );
}

function resolveCookieVariant(raw: unknown): "modal" | "corner" | "bar" {
  if (raw === "corner" || raw === "bar" || raw === "modal") return raw;
  return "modal";
}

function defaultPositionForVariant(variant: "modal" | "corner" | "bar"): OverlayPosition {
  if (variant === "modal") return "center";
  if (variant === "bar") return "bottom";
  return "bottom-right";
}

export function CookieBannerWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<CookieBannerContent>;
  const pageLanguage = usePresellPublicLocale();
  const commit = useInlineEdit();
  const copy = resolveCookieBannerCopy(c, pageLanguage);
  const title = copy.title;
  const body = copy.body;
  const allowLabel = copy.allowLabel;
  const declineLabel = copy.declineLabel;
  const policyLabel = copy.policyLabel;
  const footerNote = copy.footerNote;
  const policyUrl = (c.policyUrl ?? "/privacidade").trim() || "/privacidade";
  const accentColor = c.accentColor ?? "#2563eb";
  const variant = resolveCookieVariant(c.variant);
  const position = resolveOverlayPosition(
    c.position,
    defaultPositionForVariant(variant),
  ) as CookieBannerContent["position"];
  const backdrop = c.backdrop !== false;
  const overlayOpacity = clampCookieOverlayOpacity(c.overlayOpacity);
  const overlayBlur = clampCookieOverlayBlur(c.overlayBlur);
  const storageKey = (c.storageKey ?? "clickora-cookie-banner").trim() || "clickora-cookie-banner";
  const offerHref = (c.offerHref ?? "").trim();
  const goOffer = Boolean(offerHref && offerHref !== "#");
  const inBuilder = useBuilderSurface();
  const [dismissed, setDismissed] = useState(false);
  const [delayReady, setDelayReady] = useState(() => !c.delayMs || c.delayMs <= 0 || inBuilder);

  useEffect(() => {
    if (goOffer) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      setDismissed(false);
      return;
    }
    setDismissed(readDismissed(storageKey));
  }, [storageKey, goOffer]);

  useEffect(() => {
    if (inBuilder) {
      setDelayReady(true);
      return;
    }
    const delay = Math.max(0, c.delayMs ?? 0);
    if (delay <= 0) {
      setDelayReady(true);
      return;
    }
    setDelayReady(false);
    const t = window.setTimeout(() => setDelayReady(true), delay);
    return () => clearTimeout(t);
  }, [c.delayMs, inBuilder]);

  const usesOverlay = cookieBannerUsesPageOverlay({ inBuilder, variant, dismissed });
  const locksPage = cookieBannerLocksPage({ variant, backdrop });

  useEffect(() => {
    if (!usesOverlay || !locksPage) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [usesOverlay, locksPage]);

  const visible = inBuilder || (!dismissed && delayReady);

  const dismiss = () => {
    if (!goOffer) writeDismissed(storageKey);
    setDismissed(true);
  };

  const allowClass: CSSProperties = {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    cursor: inBuilder ? (commit ? "text" : "default") : "pointer",
    background: accentColor,
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 15,
    padding: "12px 16px",
    borderRadius: 999,
    textDecoration: "none",
    boxSizing: "border-box",
  };
  const closeClass: CSSProperties = {
    flex: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: inBuilder ? (commit ? "text" : "default") : "pointer",
    color: "#334155",
    fontWeight: 600,
    fontSize: 15,
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    textDecoration: "none",
    boxSizing: "border-box",
  };

  const saveCopy = (field: string, next: string) => {
    if (!commit) return;
    commit({ [field]: next, followLanguage: false });
  };

  if (!visible) {
    return <div style={stylesToCssWidgetContent(widget.styles, device)} aria-hidden />;
  }

  const mode =
    variant === "bar" ? "bar" : variant === "corner" ? "toast" : ("modal" as const);
  const isBar = variant === "bar" || position === "top" || position === "bottom";
  const maxW = c.maxWidthPx ?? (variant === "corner" ? 340 : 420);
  const anim = !inBuilder
    ? buildOverlayEntranceAnimation(c.animation ?? "fadeUp", c.animationDurationMs ?? 320)
    : null;
  const showCloseX = c.showCloseButton === true;

  const card = (
    <aside
      role="dialog"
      aria-modal={variant === "modal" ? true : undefined}
      aria-label={title}
      data-testid={usesOverlay ? "presell-cookie-card" : "builder-cookie-banner"}
      data-variant={variant}
      data-position={position}
      style={{
        position: "relative",
        zIndex: 2,
        ...overlayCardWidthStyle({ mode, position, maxWidthPx: maxW }),
        borderRadius: isBar ? 0 : variant === "corner" ? 10 : 16,
        padding: isBar ? "14px 18px" : variant === "modal" ? "28px 28px 24px" : "18px 18px 16px",
        borderTop: variant === "corner" ? `4px solid ${accentColor}` : undefined,
        boxShadow:
          variant === "bar"
            ? "0 4px 24px rgba(15, 23, 42, 0.12)"
            : variant === "modal"
              ? "0 25px 50px -12px rgba(15, 23, 42, 0.35)"
              : "0 12px 40px rgba(15, 23, 42, 0.18)",
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        pointerEvents: "auto",
        ...(anim ? { animation: anim.animation } : null),
      }}
    >
      {anim ? <style>{anim.keyframes}</style> : null}
      {showCloseX && !inBuilder ? (
        <button
          type="button"
          aria-label="Fechar"
          onClick={dismiss}
          style={{
            position: "absolute",
            top: 8,
            right: 10,
            border: "none",
            background: "transparent",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 20,
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
          paddingRight: showCloseX ? 24 : 0,
        }}
      >
        <div style={{ flex: isBar ? "1 1 220px" : undefined }}>
          <p
            style={{
              margin: isBar ? "0 0 4px" : "0 0 12px",
              fontSize: variant === "modal" ? 22 : 14,
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.25,
              letterSpacing: -0.2,
            }}
          >
            {commit ? (
              <span
                contentEditable
                suppressContentEditableWarning
                onMouseDown={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  const next = event.currentTarget.textContent ?? "";
                  if (next !== title) saveCopy("title", next);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
              >
                {title}
              </span>
            ) : (
              title
            )}
          </p>
          <p
            style={{
              margin: isBar ? 0 : "0 0 18px",
              fontSize: isBar ? 13 : 14,
              lineHeight: 1.6,
              color: "#475569",
            }}
          >
            {commit ? (
              <span
                contentEditable
                suppressContentEditableWarning
                onMouseDown={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  const next = event.currentTarget.textContent ?? "";
                  if (next !== body) saveCopy("body", next);
                }}
              >
                {body}
              </span>
            ) : (
              body
            )}{" "}
            {commit ? (
              <CookieText
                field="policyLabel"
                value={policyLabel}
                style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 500 }}
              />
            ) : (
              <a
                href={policyUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 500 }}
              >
                {policyLabel}
              </a>
            )}
            .
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "stretch",
            flexShrink: 0,
            minWidth: isBar ? 220 : undefined,
            width: isBar ? undefined : "100%",
          }}
        >
          {goOffer && !inBuilder ? (
            <a href={offerHref} data-testid="presell-cookie-allow-offer" style={allowClass}>
              {allowLabel}
            </a>
          ) : (
            <button type="button" onClick={inBuilder ? undefined : dismiss} style={allowClass}>
              {commit ? (
                <CookieText
                  field="allowLabel"
                  value={allowLabel}
                  style={{ color: "#ffffff", fontWeight: 700 }}
                />
              ) : (
                allowLabel
              )}
            </button>
          )}
          {goOffer && !inBuilder ? (
            <a href={offerHref} data-testid="presell-cookie-close-offer" style={closeClass}>
              {declineLabel}
            </a>
          ) : (
            <button type="button" onClick={inBuilder ? undefined : dismiss} style={closeClass}>
              {commit ? <CookieText field="declineLabel" value={declineLabel} /> : declineLabel}
            </button>
          )}
        </div>
      </div>
      {footerNote || commit ? (
        <p
          style={{
            margin: "14px 0 0",
            fontSize: 12,
            lineHeight: 1.4,
            color: "#94a3b8",
            textAlign: "center",
          }}
        >
          {commit ? (
            <span
              contentEditable
              suppressContentEditableWarning
              onMouseDown={(event) => event.stopPropagation()}
              onBlur={(event) => {
                const next = event.currentTarget.textContent ?? "";
                if (next !== footerNote) saveCopy("footerNote", next);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            >
              {footerNote}
            </span>
          ) : (
            footerNote
          )}
        </p>
      ) : null}
      {inBuilder ? (
        <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.45, color: "#94a3b8" }}>
          Modo, posição, atraso e animação no painel à direita — mesmo nível dos popups da página.
        </p>
      ) : null}
    </aside>
  );

  if (!usesOverlay) {
    return (
      <div
        data-testid="builder-cookie-inline"
        style={{
          ...stylesToCssWidgetContent(widget.styles, device),
          display: "flex",
          justifyContent: "center",
          padding: inBuilder ? "16px 8px 24px" : undefined,
        }}
      >
        {card}
      </div>
    );
  }

  const overlay = (
    <div
      data-testid="builder-cookie-modal-root"
      style={{
        ...overlayHostStyle({
          mode,
          position,
          offsetXPx: c.offsetXPx ?? 20,
          offsetYPx: c.offsetYPx ?? 20,
          zIndex: 9995,
          backdrop: false,
        }),
        ...(variant === "modal" ? { inset: 0 } : null),
      }}
    >
      {variant === "modal" && backdrop ? (
        <div
          aria-hidden
          data-testid="presell-cookie-backdrop"
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(15, 23, 42, ${overlayOpacity / 100})`,
            backdropFilter: overlayBlur > 0 ? `blur(${overlayBlur}px)` : "none",
            WebkitBackdropFilter: overlayBlur > 0 ? `blur(${overlayBlur}px)` : "none",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {card}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
