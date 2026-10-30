/** Overlay a bloquear a página só no visitante público — nunca no editor. */
export function cookieBannerUsesPageOverlay(opts: {
  inBuilder: boolean;
  variant: "modal" | "corner" | "bar";
  dismissed: boolean;
}): boolean {
  if (opts.inBuilder) return false;
  if (opts.dismissed) return false;
  // Modal e barra usam portal fixed; corner também (para não ficar preso na coluna).
  return true;
}

/** Modal com backdrop a bloquear scroll. */
export function cookieBannerLocksPage(opts: {
  variant: "modal" | "corner" | "bar";
  backdrop: boolean;
}): boolean {
  return opts.variant === "modal" && opts.backdrop;
}
