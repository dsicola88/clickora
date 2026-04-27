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
  return {
    fontFamily: t.fontFamily,
    fontSize: `${t.fontSize}px`,
    fontWeight: t.fontWeight,
    lineHeight: t.lineHeight,
    letterSpacing: `${t.letterSpacing}px`,
    textAlign: t.textAlign,
    textTransform: t.textTransform,
  };
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
