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
import { resolveCookieBannerVisual, type CookieBannerStyleContent } from "../cookieBannerStyle";
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
import { usePageBuilderT } from "../usePageBuilderT";
import type { ResponsiveValue } from "../types";
import type { CookieButtonLayout } from "../cookieBannerStyle";
import { CookiePolicyInlineSheet } from "@/components/presell/CookiePolicyInlineSheet";
import {
  readCookieConsentChoice,
  writeCookieConsentChoice,
} from "../cookieConsentStorage";

export interface CookieBannerContent extends CookieBannerStyleContent {
  title: string;
  body: string;
  allowLabel: string;
  declineLabel: string;
  policyLabel: string;
  policyUrl: string;
  footerNote?: string;
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
  offsetXPx?: number;
  offsetYPx?: number;
  showCloseButton?: boolean;
  maxWidthPx?: number | ResponsiveValue<number>;
  buttonLayout?: CookieButtonLayout | ResponsiveValue<CookieButtonLayout>;
}

function readDismissed(key: string): boolean {
  return readCookieConsentChoice(key) !== null;
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
  const t = usePageBuilderT();
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
  const policyUrl = (c.policyUrl ?? "").trim();
  /** Bloquear só privacidade SaaS; /aviso-cookies é o aviso correcto das presells. */
  const policyIsAccountPrivacy =
    policyUrl === "/privacidade" ||
    policyUrl === "/privacy" ||
    policyUrl === "/privacy-policy" ||
    /\/privacidade\/?($|\?)/i.test(policyUrl);
  const visitorPolicyUrl = !policyUrl || policyIsAccountPrivacy ? "" : policyUrl;
  const variant = resolveCookieVariant(c.variant);
  const visual = resolveCookieBannerVisual(c, device, variant);
  const position = resolveOverlayPosition(
    c.position,
    defaultPositionForVariant(variant),
  ) as CookieBannerContent["position"];
  const backdrop = c.backdrop !== false;
  const overlayOpacity = clampCookieOverlayOpacity(c.overlayOpacity);
  const overlayBlur = clampCookieOverlayBlur(c.overlayBlur);
  const storageKey = (c.storageKey ?? "clickora-cookie-banner").trim() || "clickora-cookie-banner";
  /** offerHref legado ignorado: compra vai pelos CTAs; Aceitar ≠ redirect à oferta. */
  const inBuilder = useBuilderSurface();
  const [dismissed, setDismissed] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [delayReady, setDelayReady] = useState(() => !c.delayMs || c.delayMs <= 0 || inBuilder);

  useEffect(() => {
    /** Após qualquer escolha o banner some e fica gravado — sem reaparecer a cada refresh. */
    setDismissed(readDismissed(storageKey));
  }, [storageKey]);

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

  const dismiss = (choice: "all" | "essential") => {
    writeCookieConsentChoice(storageKey, choice);
    setDismissed(true);
  };

  const allowClass: CSSProperties = {
    ...visual.allowStyle,
    cursor: inBuilder ? (commit ? "text" : "default") : "pointer",
  };
  const closeClass: CSSProperties = {
    ...visual.declineStyle,
    cursor: inBuilder ? (commit ? "text" : "default") : "pointer",
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
  const maxW = visual.maxWidthPx;
  const anim = !inBuilder
    ? buildOverlayEntranceAnimation(c.animation ?? "fadeUp", c.animationDurationMs ?? 320)
    : null;
  const showCloseX = c.showCloseButton === true;
  const stackButtons = visual.layout === "stack";

  const card = (
    <aside
      role="dialog"
      aria-modal={variant === "modal" ? true : undefined}
      aria-label={title}
      data-testid={usesOverlay ? "presell-cookie-card" : "builder-cookie-banner"}
      data-variant={variant}
      data-position={position}
      data-button-layout={visual.layout}
      style={{
        position: "relative",
        zIndex: 2,
        ...overlayCardWidthStyle({
          mode,
          position,
          maxWidthPx: maxW,
          containToParent: inBuilder,
        }),
        borderRadius: isBar ? 0 : visual.cardRadius,
        padding: isBar
          ? `${Math.max(10, visual.cardPadding - 4)}px ${visual.cardPadding}px`
          : `${visual.cardPadding}px`,
        borderTop: variant === "corner" ? `3px solid ${visual.allowBg}` : undefined,
        boxShadow:
          variant === "bar"
            ? "0 4px 24px rgba(15, 23, 42, 0.12)"
            : variant === "modal"
              ? "0 22px 48px -14px rgba(15, 23, 42, 0.28)"
              : "0 12px 36px rgba(15, 23, 42, 0.16)",
        background: visual.cardBg,
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        pointerEvents: "auto",
        ...(anim ? { animation: anim.animation } : null),
      }}
    >
      {anim ? <style>{anim.keyframes}</style> : null}
      {showCloseX && !inBuilder ? (
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={() => dismiss("essential")}
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
              margin: isBar ? "0 0 4px" : "0 0 10px",
              fontSize: visual.titleFontSize,
              fontWeight: 700,
              color: visual.titleColor,
              lineHeight: 1.3,
              letterSpacing: -0.15,
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
              margin: isBar ? 0 : "0 0 16px",
              fontSize: visual.bodyFontSize,
              lineHeight: 1.55,
              color: visual.bodyColor,
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
                style={{ color: visual.policyLinkColor, textDecoration: "underline", fontWeight: 500 }}
              />
            ) : (
              <button
                type="button"
                data-testid="builder-cookie-policy-open"
                onClick={(e) => {
                  e.stopPropagation();
                  setPolicyOpen(true);
                }}
                style={{
                  color: visual.policyLinkColor,
                  textDecoration: "underline",
                  fontWeight: 500,
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                {policyLabel}
              </button>
            )}
            .
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: stackButtons ? "column" : "row",
            gap: visual.buttonGap,
            alignItems: "stretch",
            flexShrink: 0,
            minWidth: isBar && !stackButtons ? 220 : undefined,
            width: isBar && !stackButtons ? undefined : "100%",
          }}
        >
          {/**
           * Aceitar / Fechar = consentimento apenas.
           * Compra pelos CTAs da página (/track/r/ + UTMs) — zero bloqueio artificial.
           */}
          <button
            type="button"
            data-testid="presell-cookie-allow"
            onClick={inBuilder ? undefined : () => dismiss("all")}
            style={allowClass}
          >
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
          <button
            type="button"
            data-testid="presell-cookie-close"
            onClick={inBuilder ? undefined : () => dismiss("essential")}
            style={closeClass}
          >
            {commit ? <CookieText field="declineLabel" value={declineLabel} /> : declineLabel}
          </button>
        </div>
      </div>
      {footerNote || commit ? (
        <p
          style={{
            margin: "14px 0 0",
            fontSize: 12,
            lineHeight: 1.4,
            color: visual.footerColor,
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
        <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.45, color: visual.footerColor }}>
          {t("pages.pageBuilder.widgets.cookie.builderHint")}
        </p>
      ) : null}
    </aside>
  );

  const policySheet = !inBuilder ? (
    <CookiePolicyInlineSheet
      language={pageLanguage || "en"}
      open={policyOpen}
      onClose={() => setPolicyOpen(false)}
      policyUrl={visitorPolicyUrl || "/aviso-cookies"}
    />
  ) : null;

  if (!usesOverlay) {
    return (
      <>
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
        {policySheet}
      </>
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
          containToParent: inBuilder,
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

  const tree = (
    <>
      {overlay}
      {policySheet}
    </>
  );

  if (typeof document !== "undefined") {
    return createPortal(tree, document.body);
  }
  return tree;
}
