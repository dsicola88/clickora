import { useEffect, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { useBuilderSurface } from "../builder-surface";
import { cookieBannerUsesPageOverlay } from "../cookieBannerOverlay";
import { resolveCookieBannerCopy } from "../cookieBannerCopy";
import { usePresellPublicLocale } from "@/lib/presellPublicLocale";

export interface CookieBannerContent {
  title: string;
  body: string;
  allowLabel: string;
  declineLabel: string;
  policyLabel: string;
  policyUrl: string;
  accentColor: string;
  /** modal = overlay centrado (tipo Ads); corner = canto flutuante */
  variant: "modal" | "corner";
  position: "bottom-right" | "bottom-left";
  storageKey: string;
  /** Escurece/blur o fundo no modo modal */
  backdrop: boolean;
  /** false = textos editados à mão. Ausente ou true com título de stock = idioma da página. */
  followLanguage?: boolean;
  /** Na página publicada o Accept All vai para este URL (hoplink). Vazio = só fecha o aviso. */
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

export function CookieBannerWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const c = widget.content as Partial<CookieBannerContent>;
  const pageLanguage = usePresellPublicLocale();
  const copy = resolveCookieBannerCopy(c, pageLanguage);
  const title = copy.title;
  const body = copy.body;
  const allowLabel = copy.allowLabel;
  const declineLabel = copy.declineLabel;
  const policyLabel = copy.policyLabel;
  const policyUrl = (c.policyUrl ?? "/privacidade").trim() || "/privacidade";
  const accentColor = c.accentColor ?? "#2563eb";
  const variant = c.variant === "corner" ? "corner" : "modal";
  const position = c.position ?? "bottom-right";
  const backdrop = c.backdrop !== false;
  const storageKey = (c.storageKey ?? "clickora-cookie-banner").trim() || "clickora-cookie-banner";
  const offerHref = (c.offerHref ?? "").trim();
  const lockToOffer = Boolean(offerHref && offerHref !== "#");
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
        {title}
      </p>
      <p style={{ margin: "0 0 18px", fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
        {body}{" "}
        <a
          href={policyUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#2563eb", textDecoration: "underline", fontWeight: 500 }}
        >
          {policyLabel}
        </a>
        .
      </p>
      {!inBuilder && lockToOffer ? (
        <a
          href={offerHref}
          data-clickora-offer="1"
          onClick={(e) => {
            e.preventDefault();
            window.location.assign(offerHref);
          }}
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            textAlign: "center",
            textDecoration: "none",
            background: accentColor,
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 0.06,
            textTransform: "uppercase",
            padding: "14px 18px",
            borderRadius: 10,
          }}
        >
          {allowLabel}
        </a>
      ) : (
      <button
        type="button"
        onClick={inBuilder ? undefined : dismiss}
        style={{
          display: "block",
          width: "100%",
          border: "none",
          cursor: inBuilder ? "default" : "pointer",
          background: accentColor,
          color: "#ffffff",
          fontWeight: 800,
          fontSize: 14,
          letterSpacing: 0.06,
          textTransform: "uppercase",
          padding: "14px 18px",
          borderRadius: 10,
        }}
      >
        {allowLabel}
      </button>
      )}
      {!inBuilder && lockToOffer ? (
        <a
          href={offerHref}
          data-clickora-offer="1"
          onClick={(e) => {
            e.preventDefault();
            window.location.assign(offerHref);
          }}
          style={{
            display: "block",
            width: "100%",
            marginTop: 12,
            textAlign: "center",
            textDecoration: "none",
            color: "#64748b",
            fontSize: 13,
            fontWeight: 500,
            padding: 6,
          }}
        >
          {declineLabel}
        </a>
      ) : (
      <button
        type="button"
        onClick={inBuilder ? undefined : dismiss}
        style={{
          display: "block",
          width: "100%",
          marginTop: 12,
          border: "none",
          background: "transparent",
          cursor: inBuilder ? "default" : "pointer",
          color: "#64748b",
          fontSize: 13,
          fontWeight: 500,
          padding: 6,
        }}
      >
        {declineLabel}
      </button>
      )}
      {inBuilder ? (
        <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.45, color: "#94a3b8" }}>
          No editor isto não cobre a página. Na presell publicada o visitante vê o aviso à frente da oferta.
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

  return (
    <div style={stylesToCssWidgetContent(widget.styles, device)}>
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
              background: "rgba(15, 23, 42, 0.55)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          />
        ) : null}
        {card}
      </div>
    </div>
  );
}
