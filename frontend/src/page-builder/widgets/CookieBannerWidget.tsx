import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { useBuilderSurface } from "../builder-surface";
import { cookieBannerUsesPageOverlay } from "../cookieBannerOverlay";
import {
  clampCookieOverlayBlur,
  clampCookieOverlayOpacity,
  resolveCookieBannerCopy,
} from "../cookieBannerCopy";
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
  /** modal = overlay centrado (tipo Ads); corner = canto flutuante */
  variant: "modal" | "corner";
  position: "bottom-right" | "bottom-left";
  storageKey: string;
  /** Escurece/blur o fundo no modo modal */
  backdrop: boolean;
  overlayOpacity?: number;
  overlayBlur?: number;
  /** false = textos editados à mão. Ausente ou true com título de stock = idioma da página. */
  followLanguage?: boolean;
  /**
   * Com «Ir directo à página de vendas»: Aceitar/Fechar navegam para `/track/r/…`.
   * Vazio = só desbloqueiam a review (localStorage).
   */
  offerHref?: string;
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
  const variant = c.variant === "corner" ? "corner" : "modal";
  const position = c.position ?? "bottom-right";
  const backdrop = c.backdrop !== false;
  const overlayOpacity = clampCookieOverlayOpacity(c.overlayOpacity);
  const overlayBlur = clampCookieOverlayBlur(c.overlayBlur);
  const storageKey = (c.storageKey ?? "clickora-cookie-banner").trim() || "clickora-cookie-banner";
  const offerHref = (c.offerHref ?? "").trim();
  const goOffer = Boolean(offerHref && offerHref !== "#");
  const inBuilder = useBuilderSurface();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed(storageKey));
  }, [storageKey]);

  const usesOverlay = cookieBannerUsesPageOverlay({ inBuilder, variant, dismissed });

  useEffect(() => {
    if (!usesOverlay || !backdrop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [usesOverlay, backdrop]);

  const visible = inBuilder || !dismissed;

  const dismiss = () => {
    writeDismissed(storageKey);
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

  const card = (
    <aside
      role="dialog"
      aria-modal={variant === "modal" ? true : undefined}
      aria-label={title}
      data-testid={usesOverlay ? "presell-cookie-card" : "builder-cookie-banner"}
      data-variant={variant}
      style={{
        ...(variant === "modal"
          ? {
              position: "relative" as const,
              zIndex: 2,
              width: "min(420px, calc(100vw - 32px))",
              borderRadius: 16,
              padding: "28px 28px 24px",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.35)",
            }
          : {
              position: "fixed" as const,
              bottom: 20,
              ...(position === "bottom-left" ? { left: 20 } : { right: 20 }),
              zIndex: 9995,
              width: "min(340px, calc(100vw - 40px))",
              borderRadius: 10,
              padding: "18px 18px 16px",
              borderTop: `4px solid ${accentColor}`,
              boxShadow: "0 12px 40px rgba(15, 23, 42, 0.18)",
            }),
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
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
      <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
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
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        {goOffer && !inBuilder ? (
          <a
            href={offerHref}
            data-testid="presell-cookie-allow-offer"
            onClick={dismiss}
            style={allowClass}
          >
            {allowLabel}
          </a>
        ) : (
          <button type="button" onClick={inBuilder ? undefined : dismiss} style={allowClass}>
            {commit ? (
              <CookieText field="allowLabel" value={allowLabel} style={{ color: "#ffffff", fontWeight: 700 }} />
            ) : (
              allowLabel
            )}
          </button>
        )}
        {goOffer && !inBuilder ? (
          <a
            href={offerHref}
            data-testid="presell-cookie-close-offer"
            onClick={dismiss}
            style={closeClass}
          >
            {declineLabel}
          </a>
        ) : (
          <button type="button" onClick={inBuilder ? undefined : dismiss} style={closeClass}>
            {commit ? <CookieText field="declineLabel" value={declineLabel} /> : declineLabel}
          </button>
        )}
      </div>
      {footerNote || commit ? (
        <p style={{ margin: "14px 0 0", fontSize: 12, lineHeight: 1.4, color: "#94a3b8", textAlign: "center" }}>
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
          Clique nos textos para editar. O fundo escuro e os botões também estão no painel à direita. Na página
          publicada o aviso cobre a oferta.
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
        position: "fixed",
        inset: 0,
        zIndex: 9995,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {backdrop ? (
        <div
          aria-hidden
          data-testid="presell-cookie-backdrop"
          style={{
            position: "absolute",
            inset: 0,
            background: `rgba(15, 23, 42, ${overlayOpacity / 100})`,
            backdropFilter: overlayBlur > 0 ? `blur(${overlayBlur}px)` : "none",
            WebkitBackdropFilter: overlayBlur > 0 ? `blur(${overlayBlur}px)` : "none",
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
