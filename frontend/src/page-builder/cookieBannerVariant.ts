import { resolveOverlayPosition, type OverlayPosition } from "./overlay-placement";

export type CookieBannerVariant = "modal" | "corner" | "bar";

/** Quando false (default legado), a live usa barra em baixo — independente do editor. */
export function shouldHonorCookieVariantOnPublic(content: {
  useEditorVariantOnPublic?: boolean;
}): boolean {
  return content.useEditorVariantOnPublic === true;
}

export function resolveCookieVariant(
  raw: unknown,
  opts: { inBuilder: boolean; honorEditorVariant: boolean },
): CookieBannerVariant {
  if (!opts.inBuilder && !opts.honorEditorVariant) return "bar";
  if (raw === "corner" || raw === "bar" || raw === "modal") return raw;
  return "bar";
}

export function defaultPositionForVariant(variant: CookieBannerVariant): OverlayPosition {
  if (variant === "modal") return "center";
  if (variant === "bar") return "bottom";
  return "bottom-right";
}

export function resolveCookieBannerPosition(args: {
  position: unknown;
  variant: CookieBannerVariant;
  inBuilder: boolean;
  honorEditorVariant: boolean;
}): OverlayPosition {
  if (!args.inBuilder && !args.honorEditorVariant) {
    return "bottom";
  }
  return resolveOverlayPosition(args.position, defaultPositionForVariant(args.variant));
}