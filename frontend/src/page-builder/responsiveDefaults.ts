import type { DeviceType, ResponsiveValue, SpacingValue, TypographyValue } from "./types";

/** Alinhado ao canvas (tablet 768) e ao NavMenu (767). */
export const BUILDER_MOBILE_MAX_PX = 767;
export const BUILDER_TABLET_MAX_PX = 1024;

export function viewportToBuilderDevice(widthPx: number): DeviceType {
  if (widthPx <= BUILDER_MOBILE_MAX_PX) return "mobile";
  if (widthPx <= BUILDER_TABLET_MAX_PX) return "tablet";
  return "desktop";
}

function hasDeviceOverride<T>(
  v: ResponsiveValue<T> | undefined,
  device: DeviceType,
): boolean {
  if (!v || device === "desktop") return true;
  if (device === "mobile") return v.mobile !== undefined;
  return v.tablet !== undefined;
}

/** Escala tipografia no telemóvel/tablet quando o autor não definiu override. */
export function scaleTypographyForDevice(
  typography: ResponsiveValue<TypographyValue> | undefined,
  device: DeviceType,
): TypographyValue | undefined {
  if (!typography) return undefined;
  const base =
    device === "mobile"
      ? typography.mobile ?? typography.tablet ?? typography.desktop
      : device === "tablet"
        ? typography.tablet ?? typography.desktop
        : typography.desktop;
  if (!base) return undefined;
  if (device === "desktop" || hasDeviceOverride(typography, device)) return base;

  const scale = device === "mobile" ? 0.78 : 0.9;
  const minPx = device === "mobile" ? 15 : 15;
  const size = base.fontSize ?? 16;
  if (size < 20) return base;
  return {
    ...base,
    fontSize: Math.max(minPx, Math.round(size * scale)),
  };
}

/** Reduz padding vertical de secções/widgets largos no telemóvel sem override. */
export function scaleSpacingForDevice(
  spacing: ResponsiveValue<SpacingValue> | undefined,
  device: DeviceType,
  opts?: { minSide?: number },
): SpacingValue | undefined {
  if (!spacing) return undefined;
  const base =
    device === "mobile"
      ? spacing.mobile ?? spacing.tablet ?? spacing.desktop
      : device === "tablet"
        ? spacing.tablet ?? spacing.desktop
        : spacing.desktop;
  if (!base) return undefined;
  if (device === "desktop" || hasDeviceOverride(spacing, device)) return base;

  const scale = device === "mobile" ? 0.55 : 0.75;
  const floor = opts?.minSide ?? (device === "mobile" ? 12 : 14);
  /** Só encolhe lados > 0 — nunca inventa padding onde o autor pôs 0 (heroes/headers flush). */
  const shrink = (n: number) => {
    if (n <= 0) return 0;
    if (n <= floor) return n;
    return Math.max(floor, Math.round(n * scale));
  };
  const shrinkHorizontal = (n: number) => {
    if (n <= 0) return 0;
    const capped = device === "mobile" ? Math.min(n, 16) : n;
    return shrink(capped);
  };
  return {
    ...base,
    top: shrink(base.top),
    bottom: shrink(base.bottom),
    right: shrinkHorizontal(base.right),
    left: shrinkHorizontal(base.left),
  };
}

/** Altura de spacer: encolhe no telemóvel se só houver desktop. */
export function scaleLengthForDevice(
  value: ResponsiveValue<string> | undefined,
  device: DeviceType,
): string | undefined {
  if (!value) return undefined;
  const raw =
    device === "mobile"
      ? value.mobile ?? value.tablet ?? value.desktop
      : device === "tablet"
        ? value.tablet ?? value.desktop
        : value.desktop;
  if (!raw) return undefined;
  if (device === "desktop" || hasDeviceOverride(value, device)) return raw;
  const m = /^(\d+(?:\.\d+)?)px$/i.exec(raw.trim());
  if (!m) return raw;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 28) return raw;
  const scale = device === "mobile" ? 0.6 : 0.8;
  return `${Math.max(16, Math.round(n * scale))}px`;
}
