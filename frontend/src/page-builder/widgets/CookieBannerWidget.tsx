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
  resolveCookieBannerPosition,
  resolveCookieVariant,
  shouldHonorCookieVariantOnPublic,
} from "../cookieBannerVariant";
import {
  buildOverlayEntranceAnimation,
  overlayCardWidthStyle,
  overlayHostStyle,
  type OverlayAnimation,
} from "../overlay-placement";
import { usePresellPublicLocale } from "@/lib/presellPublicLocale";
import { useInlineEdit } from "../inline-edit";
import { usePageBuilderT } from "../usePageBuilderT";
import type { ResponsiveValue } from "../types";
import type { CookieButtonLayout } from "../cookieBannerStyle";
import { CookiePolicyInlineSheet } from "@/components/presell/CookiePolicyInlineSheet";
import { cookieConsentNavigation } from "@/components/presell/PresellTypeControls";
import { mergeLandingAdParamsIntoTrackHref } from "@/lib/presellTrackAdParams";
import {
  COOKIE_CONSENT_EVENT,
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
  useEditorVariantOnPublic?: boolean;
  stylePreset?: string;
  allowHoverBg?: string;
  declineHoverBg?: string;
  policyLinkHoverColor?: string;
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
  const inBuilder = useBuilderSurface();
  const honorEditorVariant = shouldHonorCookieVariantOnPublic(c);
  /** Live legado = barra; com «igual ao editor» respeita modal/canto/barra. */
  const variant = resolveCookieVariant(c.variant, { inBuilder, honorEditorVariant });
  const visual = resolveCookieBannerVisual(c, device, variant);
  const position = resolveCookieBannerPosition({
    position: c.position,
    variant,
    inBuilder,
    honorEditorVariant,
  }) as CookieBannerContent["position"];
  const scopeId = `ck-${widget.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const backdrop = c.backdrop !== false;
  const overlayOpacity = clampCookieOverlayOpacity(c.overlayOpacity);
  const overlayBlur = clampCookieOverlayBlur(c.overlayBlur);
  const storageKey = (c.storageKey ?? "clickora-cookie-banner").trim() || "clickora-cookie-banner";
  /**
   * `offerHref` só é baked quando `settings.cookieRedirectToOffer` está activo.
   * Sem ele, Aceitar grava consentimento e a compra fica nos CTAs (`/track/r/`).
   */
  const offerNav =
    !inBuilder
      ? cookieConsentNavigation("allow", (c.offerHref ?? "").trim(), "")
      : ({ kind: "stay" } as const);
  const [dismissed, setDismissed] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [delayReady, setDelayReady] = useState(() => !c.delayMs || c.delayMs <= 0 || inBuilder);

  useEffect(() => {
    /** Após qualquer escolha o banner some; clearCookieConsentChoice volta a mostrá-lo. */
    const sync = () => setDismissed(readDismissed(storageKey));
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
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
    cursor: inBuilder && commit ? "text" : "pointer",
    transition: "background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease",
  };
  const closeClass: CSSProperties = {
    ...visual.declineStyle,
    cursor: inBuilder && commit ? "text" : "pointer",
    transition: "background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease",
  };
  const hoverCss = `
    #${scopeId} .cookie-allow-btn:hover { background: ${visual.allowHoverBg} !important; }
    #${scopeId} .cookie-decline-btn:hover { background: ${visual.declineHoverBg} !important; }
    #${scopeId} .cookie-policy-link:hover { color: ${visual.policyLinkHoverColor} !important; }
    #${scopeId} .cookie-allow-btn, #${scopeId} .cookie-decline-btn, #${scopeId} .cookie-policy-link { cursor: pointer; }
  `;

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
      id={scopeId}
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
      <style>{hoverCss}</style>
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
                style={{
                  color: visual.policyLinkColor,
                  textDecoration: "underline",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              />
            ) : (
              <button
                type="button"
                data-testid="builder-cookie-policy-open"
                onClick={(e) => {
                  e.stopPropagation();
                  setPolicyOpen(true);
                }}
                className="cookie-policy-link"
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
           * Fechar = só essenciais; página/CTAs ficam.
           * Aceitar = all; se cookieRedirectToOffer (offerHref baked) → /track/r/.
           */}
          {offerNav.kind === "assign" ? (
            <a
              href={offerNav.url}
              data-testid="presell-cookie-allow-offer"
              data-clickora-cookie-allow-offer="1"
              className="cookie-allow-btn"
              style={{
                ...allowClass,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={(e) => {
                if (inBuilder) {
                  e.preventDefault();
                  return;
                }
                // Gravar consentimento desmonta o banner — assign explícito evita cancelar a navegação.
                e.preventDefault();
                const dest =
                  mergeLandingAdParamsIntoTrackHref(offerNav.url, window.location.search) ||
                  offerNav.url;
                writeCookieConsentChoice(storageKey, "all");
                window.location.assign(dest);
              }}
            >
              {allowLabel}
            </a>
          ) : (
            <button
              type="button"
              data-testid="presell-cookie-allow"
              onClick={inBuilder ? undefined : () => dismiss("all")}
              className="cookie-allow-btn"
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
          )}
          <button
            type="button"
            data-testid="presell-cookie-close"
            onClick={inBuilder ? undefined : () => dismiss("essential")}
            className="cookie-decline-btn"
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
      policyUrl=""
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
