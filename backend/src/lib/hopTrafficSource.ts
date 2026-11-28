const PLACEHOLDER = /^(direct|none|\(none\)|\(direct\))$/i;

function real(v: string | null | undefined): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s && !PLACEHOLDER.test(s) ? s : undefined;
}

/**
 * O CTA da presell envia `source=direct&medium=none` quando a landing não tem UTMs.
 * Estes valores não são encaminhados ao hoplink como UTM; num clique pago a origem
 * vem do click ID (gclid → google, …) em vez de «direct».
 */
export function hopTrafficSource(args: {
  source?: string | null;
  medium?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  msclkid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
}): {
  source: string | undefined;
  medium: string | undefined;
  /** Só valores reais — o que pode seguir para o hoplink como utm_*. */
  utmSource: string | undefined;
  utmMedium: string | undefined;
} {
  const source = real(args.source);
  const medium = real(args.medium);
  if (source) return { source, medium, utmSource: source, utmMedium: medium };
  const paidSource =
    args.gclid || args.gbraid || args.wbraid
      ? "google"
      : args.msclkid
        ? "bing"
        : args.fbclid
          ? "facebook"
          : args.ttclid
            ? "tiktok"
            : undefined;
  return {
    source: paidSource,
    medium: medium ?? (paidSource ? "cpc" : undefined),
    utmSource: undefined,
    utmMedium: medium,
  };
}
