/** Overlay a bloquear a página só no visitante público — nunca no editor. */
export function cookieBannerUsesPageOverlay(opts: {
  inBuilder: boolean;
  variant: "modal" | "corner";
  dismissed: boolean;
}): boolean {
  if (opts.inBuilder) return false;
  if (opts.variant !== "modal") return false;
  return !opts.dismissed;
}
