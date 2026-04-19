import type { CSSProperties } from "react";
import type {
  BaseStyles,
  DeviceType,
  ResponsiveStyles,
  SpacingValue,
  TypographyValue,
} from "./types";
import { resolveResponsive } from "./store";

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
  return out;
}

/** Build a CSS style object from a node's styles for the given device. */
export function stylesToCss(
  styles: BaseStyles & ResponsiveStyles,
  device: DeviceType,
): CSSProperties {
  const padding = resolveResponsive(styles.padding, device);
  const margin = resolveResponsive(styles.margin, device);
  const typography = resolveResponsive(styles.typography, device);
  const width = resolveResponsive(styles.width, device);
  const height = resolveResponsive(styles.height, device);
  const visible = resolveResponsive(styles.visibility, device);
  const position = resolveResponsive(styles.position, device);
  const zIndex = resolveResponsive(styles.zIndex, device);
  const alignSelf = resolveResponsive(styles.alignSelf, device);
  const order = resolveResponsive(styles.order, device);
  const flexGrow = resolveResponsive(styles.flexGrow, device);
  const flexShrink = resolveResponsive(styles.flexShrink, device);

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
  if (zIndex !== undefined && zIndex !== null && !Number.isNaN(zIndex)) css.zIndex = zIndex;
  if (alignSelf) css.alignSelf = alignSelf;
  if (order !== undefined && order !== null && !Number.isNaN(order)) css.order = order;
  if (flexGrow !== undefined && flexGrow !== null && !Number.isNaN(flexGrow)) css.flexGrow = flexGrow;
  if (flexShrink !== undefined && flexShrink !== null && !Number.isNaN(flexShrink)) css.flexShrink = flexShrink;

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
