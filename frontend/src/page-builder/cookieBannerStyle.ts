import type { CSSProperties } from "react";
import type { DeviceType, ResponsiveValue } from "./types";
import { resolveResponsive } from "./store";

export type CookieButtonLayout = "row" | "stack";

export type CookieBannerStyleContent = {
  /** Cor do botão Aceitar (legado: accentColor). */
  accentColor?: string;
  allowBg?: string;
  allowTextColor?: string;
  declineBg?: string;
  declineTextColor?: string;
  declineBorderColor?: string;
  /** 0–32; default 10 (não pill). */
  buttonRadius?: number;
  buttonFontWeight?: number;
  buttonGap?: number;
  cardBg?: string;
  cardRadius?: number;
  titleColor?: string;
  bodyColor?: string;
  policyLinkColor?: string;
  footerColor?: string;
  /** Número legado ou responsivo por dispositivo. */
  maxWidthPx?: number | ResponsiveValue<number>;
  buttonLayout?: CookieButtonLayout | ResponsiveValue<CookieButtonLayout>;
  buttonFontSize?: number | ResponsiveValue<number>;
  buttonPaddingY?: number | ResponsiveValue<number>;
  buttonPaddingX?: number | ResponsiveValue<number>;
  cardPadding?: number | ResponsiveValue<number>;
  titleFontSize?: number | ResponsiveValue<number>;
  bodyFontSize?: number | ResponsiveValue<number>;
};

function asResponsiveNumber(
  raw: number | ResponsiveValue<number> | undefined,
  fallback: number,
): ResponsiveValue<number> {
  if (typeof raw === "number" && Number.isFinite(raw)) return { desktop: raw };
  if (raw && typeof raw === "object" && typeof (raw as ResponsiveValue<number>).desktop === "number") {
    return raw as ResponsiveValue<number>;
  }
  return { desktop: fallback };
}

function asResponsiveLayout(
  raw: CookieButtonLayout | ResponsiveValue<CookieButtonLayout> | undefined,
  fallback: ResponsiveValue<CookieButtonLayout>,
): ResponsiveValue<CookieButtonLayout> {
  if (raw === "row" || raw === "stack") return { desktop: raw };
  if (raw && typeof raw === "object" && (raw.desktop === "row" || raw.desktop === "stack")) {
    return raw as ResponsiveValue<CookieButtonLayout>;
  }
  return fallback;
}

export function setCookieResponsiveNumber(
  current: number | ResponsiveValue<number> | undefined,
  device: DeviceType,
  value: number,
  fallbackDesktop: number,
): ResponsiveValue<number> {
  const base = asResponsiveNumber(current, fallbackDesktop);
  const next = { ...base };
  if (device === "desktop") next.desktop = value;
  if (device === "tablet") next.tablet = value;
  if (device === "mobile") next.mobile = value;
  return next;
}

export function setCookieResponsiveLayout(
  current: CookieButtonLayout | ResponsiveValue<CookieButtonLayout> | undefined,
  device: DeviceType,
  value: CookieButtonLayout,
): ResponsiveValue<CookieButtonLayout> {
  const base = asResponsiveLayout(current, { desktop: "row", tablet: "row", mobile: "stack" });
  const next = { ...base };
  if (device === "desktop") next.desktop = value;
  if (device === "tablet") next.tablet = value;
  if (device === "mobile") next.mobile = value;
  return next;
}

export function resolveCookieBannerVisual(
  c: CookieBannerStyleContent,
  device: DeviceType,
  variant: "modal" | "corner" | "bar",
) {
  const allowBg = (c.allowBg ?? c.accentColor ?? "#0f172a").trim() || "#0f172a";
  const allowText = (c.allowTextColor ?? "#ffffff").trim() || "#ffffff";
  const declineBg = (c.declineBg ?? "#ffffff").trim() || "#ffffff";
  const declineText = (c.declineTextColor ?? "#334155").trim() || "#334155";
  const declineBorder = (c.declineBorderColor ?? "#cbd5e1").trim() || "#cbd5e1";
  const buttonRadius = Math.min(32, Math.max(0, Math.round(c.buttonRadius ?? 10)));
  const buttonGap = Math.min(24, Math.max(4, Math.round(c.buttonGap ?? 10)));
  const cardBg = (c.cardBg ?? "#ffffff").trim() || "#ffffff";
  const cardRadius =
    variant === "bar"
      ? 0
      : Math.min(28, Math.max(0, Math.round(c.cardRadius ?? (variant === "corner" ? 12 : 14))));
  const titleColor = (c.titleColor ?? "#0f172a").trim() || "#0f172a";
  const bodyColor = (c.bodyColor ?? "#475569").trim() || "#475569";
  const policyLinkColor = (c.policyLinkColor ?? allowBg).trim() || allowBg;
  const footerColor = (c.footerColor ?? "#94a3b8").trim() || "#94a3b8";

  const maxWidthFallback = variant === "corner" ? 340 : 420;
  /** Hierarquia estável: desktop ≥ tablet ≥ mobile (evita tablet «mais expandido»). */
  const maxWidthResponsive = asResponsiveNumber(c.maxWidthPx, maxWidthFallback);
  const desktopMax = maxWidthResponsive.desktop ?? maxWidthFallback;
  const tabletMax = Math.min(maxWidthResponsive.tablet ?? desktopMax, desktopMax);
  const mobileMax = Math.min(
    maxWidthResponsive.mobile ?? tabletMax,
    tabletMax,
  );
  const maxWidthPx =
    resolveResponsive(
      { desktop: desktopMax, tablet: tabletMax, mobile: mobileMax },
      device,
    ) ?? maxWidthFallback;

  const layout =
    resolveResponsive(
      asResponsiveLayout(c.buttonLayout, { desktop: "row", tablet: "row", mobile: "stack" }),
      device,
    ) ?? "row";

  const buttonFontSize =
    resolveResponsive(asResponsiveNumber(c.buttonFontSize, 14), device) ?? 14;
  const buttonPaddingY =
    resolveResponsive(asResponsiveNumber(c.buttonPaddingY, 11), device) ?? 11;
  const buttonPaddingX =
    resolveResponsive(asResponsiveNumber(c.buttonPaddingX, 16), device) ?? 16;
  const cardPadding =
    resolveResponsive(
      asResponsiveNumber(c.cardPadding, variant === "modal" ? 24 : variant === "bar" ? 14 : 16),
      device,
    ) ?? 24;
  const titleFontSize =
    resolveResponsive(
      asResponsiveNumber(c.titleFontSize, variant === "modal" ? 18 : 14),
      device,
    ) ?? 18;
  const bodyFontSize =
    resolveResponsive(asResponsiveNumber(c.bodyFontSize, variant === "bar" ? 13 : 14), device) ??
    14;

  const allowStyle: CSSProperties = {
    flex: layout === "row" ? 1 : undefined,
    width: layout === "stack" ? "100%" : undefined,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: allowBg,
    color: allowText,
    fontWeight: Math.min(800, Math.max(500, Math.round(c.buttonFontWeight ?? 600))),
    fontSize: buttonFontSize,
    padding: `${buttonPaddingY}px ${buttonPaddingX}px`,
    borderRadius: buttonRadius,
    textDecoration: "none",
    boxSizing: "border-box",
    letterSpacing: 0.01,
    lineHeight: 1.2,
  };

  const declineStyle: CSSProperties = {
    flex: layout === "row" ? 1 : undefined,
    width: layout === "stack" ? "100%" : undefined,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: declineBg,
    color: declineText,
    fontWeight: Math.min(800, Math.max(500, Math.round((c.buttonFontWeight ?? 600) - 50))),
    fontSize: buttonFontSize,
    padding: `${buttonPaddingY}px ${buttonPaddingX}px`,
    borderRadius: buttonRadius,
    border: `1px solid ${declineBorder}`,
    textDecoration: "none",
    boxSizing: "border-box",
    letterSpacing: 0.01,
    lineHeight: 1.2,
  };

  return {
    allowBg,
    allowStyle,
    declineStyle,
    buttonGap,
    cardBg,
    cardRadius,
    titleColor,
    bodyColor,
    policyLinkColor,
    footerColor,
    maxWidthPx,
    layout,
    cardPadding,
    titleFontSize,
    bodyFontSize,
    buttonFontSize,
    buttonPaddingY,
    buttonPaddingX,
    buttonRadius,
    buttonLayoutResolved: layout,
  };
}
