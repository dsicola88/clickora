import type { CSSProperties } from "react";
import type {
  BaseStyles,
  DeviceType,
  FlexAlign,
  FlexDirection,
  FlexJustify,
  FlexLayout,
  FlexWrapMode,
  ResponsiveStyles,
  SpacingValue,
  TypographyValue,
} from "./types";
import { resolveResponsive } from "./store";
import {
  scaleLengthForDevice,
  scaleSpacingForDevice,
  scaleTypographyForDevice,
} from "./responsiveDefaults";

function spacingToCss(s: SpacingValue | undefined): string | undefined {
  if (!s) return undefined;
  const u = s.unit;
  return `${s.top}${u} ${s.right}${u} ${s.bottom}${u} ${s.left}${u}`;
}

function typographyToCss(t: TypographyValue | undefined): CSSProperties {
  if (!t) return {};
  const fsu = t.fontSizeUnit ?? "px";
  const fontSize = `${t.fontSize}${fsu}`;

  const lhu = t.lineHeightUnit ?? "";
  const lineHeight: string | number =
    lhu === "" ? t.lineHeight : `${t.lineHeight}${lhu}`;

  const lsu = t.letterSpacingUnit ?? "px";
  const letterSpacing = `${t.letterSpacing}${lsu}`;

  const out: CSSProperties = {
    fontFamily: t.fontFamily,
    fontSize,
    fontWeight: t.fontWeight,
    lineHeight,
    letterSpacing,
    textAlign: t.textAlign,
    textTransform: t.textTransform,
    fontStyle: t.fontStyle,
    textDecoration: t.textDecoration,
  };

  if (t.wordSpacing !== undefined && !Number.isNaN(Number(t.wordSpacing))) {
    const wu = t.wordSpacingUnit ?? "px";
    out.wordSpacing = `${t.wordSpacing}${wu}`;
  }

  return out;
}

/** Estilos que devem aplicar-se ao invólucro do widget (filho flex da coluna). */
const WIDGET_SHELL_KEYS = new Set([
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
  "order",
  "alignSelf",
  "flexGrow",
  "flexShrink",
]);

/** Estilos visuais do conteúdo (sem a «casca» flex). */
export function stylesToCssWidgetContent(
  styles: BaseStyles & ResponsiveStyles,
  device: DeviceType,
): CSSProperties {
  const css = stylesToCss(styles, device);
  const out = { ...css };
  for (const k of WIDGET_SHELL_KEYS) {
    delete (out as Record<string, unknown>)[k];
  }
  return out;
}

export function stylesToCssWidgetShell(
  styles: BaseStyles & ResponsiveStyles,
  device: DeviceType,
): CSSProperties {
  const css = stylesToCss(styles, device);
  const out: CSSProperties = {};
  for (const k of WIDGET_SHELL_KEYS) {
    const v = (css as Record<string, unknown>)[k];
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  // Sticky/fixed só funciona se position + top estiverem no mesmo elemento.
  if ((out.position === "sticky" || out.position === "fixed") && out.top === undefined) {
    out.top = "0";
  }
  if ((out.position === "sticky" || out.position === "fixed") && out.zIndex === undefined) {
    out.zIndex = 200;
  }

  // Alinhamento do bloco (Elementor-like) no invólucro — vale para todos os widgets.
  const blockAlign = resolveResponsive(styles.align, device);
  const width = resolveResponsive(styles.width, device);
  const hasCustomWidth = Boolean(width && width !== "100%");
  if (blockAlign === "center") {
    if (hasCustomWidth) {
      out.width = width;
      out.maxWidth = "100%";
      out.marginLeft = "auto";
      out.marginRight = "auto";
    } else if (!out.alignSelf || out.alignSelf === "auto") {
      out.alignSelf = "center";
      out.width = "100%";
      out.maxWidth = "100%";
    }
  } else if (blockAlign === "right") {
    if (hasCustomWidth) {
      out.width = width;
      out.maxWidth = "100%";
      out.marginLeft = "auto";
    } else if (!out.alignSelf || out.alignSelf === "auto") {
      out.alignSelf = "flex-end";
      out.width = "fit-content";
      out.maxWidth = "100%";
    }
  } else if (blockAlign === "left" && hasCustomWidth) {
    out.width = width;
    out.maxWidth = "100%";
    out.marginRight = "auto";
  }

  return out;
}

/** Direção do contentor. Em tablet/telemóvel, várias colunas empilham salvo override explícito. */
export function sectionDirectionFor(
  flex: FlexLayout["direction"] | undefined,
  device: DeviceType,
  columnCount: number,
): FlexDirection {
  if (device === "mobile" && flex?.mobile) return flex.mobile;
  if (device === "tablet" && flex?.tablet) return flex.tablet;
  if (device === "desktop" && flex?.desktop) return flex.desktop;
  if ((device === "mobile" || device === "tablet") && columnCount > 1) return "column";
  if (flex?.desktop) return flex.desktop;
  return "row";
}

export function isSectionStacked(direction: FlexDirection) {
  return direction === "column" || direction === "column-reverse";
}

export function columnFlexItem(widthPercent: number, stacked: boolean): CSSProperties {
  if (stacked) return { width: "100%", flex: "0 0 auto", minWidth: 0 };
  return { flex: `${Math.max(widthPercent, 1)} 1 0%`, width: "auto", minWidth: 0 };
}

/** Contentor flex das colunas. A direção em linha usa `flex-grow` para o intervalo não partir 50%+50%. */
export function sectionColumnsGrid(
  widths: number[],
  device: DeviceType,
  gapPx: number,
  flex?: {
    direction?: FlexDirection;
    justify?: FlexJustify;
    align?: FlexAlign;
    wrap?: FlexWrapMode;
  },
): CSSProperties {
  const direction =
    flex?.direction ??
    ((device === "mobile" || device === "tablet") && widths.length > 1 ? "column" : "row");
  const stacked = isSectionStacked(direction);
  return {
    display: "flex",
    flexDirection: direction,
    flexWrap: stacked ? "nowrap" : (flex?.wrap ?? "wrap"),
    justifyContent: flex?.justify ?? "flex-start",
    alignItems: flex?.align ?? "stretch",
    gap: `${gapPx}px`,
    width: "100%",
  };
}

/** Build a CSS style object from a node's styles for the given device. */
export function stylesToCss(
  styles: BaseStyles & ResponsiveStyles,
  device: DeviceType,
): CSSProperties {
  const padding = scaleSpacingForDevice(styles.padding, device);
  const margin = scaleSpacingForDevice(styles.margin, device, { minSide: 0 });
  const typography = scaleTypographyForDevice(styles.typography, device);
  const width = resolveResponsive(styles.width, device);
  const height = scaleLengthForDevice(styles.height, device) ?? resolveResponsive(styles.height, device);
  const visible = resolveResponsive(styles.visibility, device);
  const position = resolveResponsive(styles.position, device);
  const top = resolveResponsive(styles.top, device);
  const right = resolveResponsive(styles.right, device);
  const bottom = resolveResponsive(styles.bottom, device);
  const left = resolveResponsive(styles.left, device);
  const zIndex = resolveResponsive(styles.zIndex, device);
  const alignSelf = resolveResponsive(styles.alignSelf, device);
  const order = resolveResponsive(styles.order, device);
  const flexGrow = resolveResponsive(styles.flexGrow, device);
  const flexShrink = resolveResponsive(styles.flexShrink, device);
  const justifyContent = resolveResponsive(styles.justifyContent, device);

  const css: CSSProperties = {
    padding: spacingToCss(padding),
    margin: spacingToCss(margin),
    color: styles.color,
    background: styles.background,
    opacity: styles.opacity,
    width,
    height,
    boxShadow: styles.boxShadow,
    ...typographyToCss(typography),
  };

  if (position) css.position = position;
  if (top) css.top = top;
  else if (position === "sticky" || position === "fixed") css.top = "0";
  if (right) css.right = right;
  if (bottom) css.bottom = bottom;
  if (left) css.left = left;
  if (zIndex !== undefined && zIndex !== null && !Number.isNaN(zIndex)) css.zIndex = zIndex;
  if (alignSelf) css.alignSelf = alignSelf;
  if (order !== undefined && order !== null && !Number.isNaN(order)) css.order = order;
  if (flexGrow !== undefined && flexGrow !== null && !Number.isNaN(flexGrow)) css.flexGrow = flexGrow;
  if (flexShrink !== undefined && flexShrink !== null && !Number.isNaN(flexShrink)) css.flexShrink = flexShrink;
  if (justifyContent) css.justifyContent = justifyContent;

  if (visible === false) {
    css.display = "none";
  }

  if (styles.border) {
    css.border = `${styles.border.width}px ${styles.border.style} ${styles.border.color}`;
    css.borderRadius = `${styles.border.radius}px`;
  }

  // Strip undefined keys to avoid inline-style noise
  Object.keys(css).forEach((k) => {
    if ((css as Record<string, unknown>)[k] === undefined) {
      delete (css as Record<string, unknown>)[k];
    }
  });

  return css;
}

export function alignToFlexJustify(
  align: "left" | "center" | "right" | undefined,
): CSSProperties["justifyContent"] {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
}
