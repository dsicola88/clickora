/**
 * Crédito «powered by dclickora» na API pública da presell.
 *
 * - Plano com `hasBranding=true` (free/trial): sempre mostra.
 * - Plano white-label (`hasBranding=false`): omite por omissão; só mostra se
 *   `hidePoweredBy === false` (toggle «Ocultar powered by» desligado).
 */
export function resolvePublicFooterBranding(args: {
  planHasBranding: boolean | null | undefined;
  hidePoweredBy: boolean | null | undefined;
}): boolean {
  const planHas = args.planHasBranding ?? true;
  if (planHas) return true;
  return args.hidePoweredBy === false;
}
