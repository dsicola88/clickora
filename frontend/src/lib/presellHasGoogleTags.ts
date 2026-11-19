import { detectPastedAdPixelBases } from "@/lib/presellOptionalSettingsMarketing";

/**
 * True se a página tem tags Google (Ads/GA4/GTM) configuradas.
 * Usado para não inventar Consent Mode / gtag stub sem Google no funil.
 */
export function presellHasConfiguredGoogleTags(input: {
  settings?: Record<string, unknown> | null;
  conversionTrackingScript?: string | null;
  headerCode?: string | null;
  bodyCode?: string | null;
  footerCode?: string | null;
  optionalMarketingHeadHtml?: string | null;
  optionalMarketingBodyHtml?: string | null;
  builderTracking?: {
    gtmId?: string;
    ga4Id?: string;
    customHeadCode?: string;
    customBodyCode?: string;
  } | null;
}): boolean {
  const s = input.settings ?? {};
  const googleField = String(s.googleTrackingCode ?? "").trim();
  const convEvent = String(s.googleConversionEvent ?? "").trim();
  if (googleField || convEvent) return true;

  const blob = [
    googleField,
    convEvent,
    String(input.conversionTrackingScript ?? ""),
    String(input.headerCode ?? ""),
    String(input.bodyCode ?? ""),
    String(input.footerCode ?? ""),
    String(input.optionalMarketingHeadHtml ?? ""),
    String(input.optionalMarketingBodyHtml ?? ""),
    String(s.conversionTrackingScript ?? ""),
    String(s.headerCode ?? ""),
    String(s.bodyCode ?? ""),
    String(s.footerCode ?? ""),
    String(input.builderTracking?.gtmId ?? ""),
    String(input.builderTracking?.ga4Id ?? ""),
    String(input.builderTracking?.customHeadCode ?? ""),
    String(input.builderTracking?.customBodyCode ?? ""),
  ].join("\n");

  if (detectPastedAdPixelBases(blob).google) return true;

  const t = input.builderTracking;
  if (t?.gtmId?.trim() || t?.ga4Id?.trim()) return true;

  return false;
}
