/**
 * Limites por plataforma e formato. Não partilhar um único número entre Google e Microsoft.
 *
 * Google Ads — Responsive search ads:
 * https://support.google.com/google-ads/answer/7684791
 * https://support.google.com/google-ads/answer/17092074
 * Sitelinks: https://support.google.com/google-ads/answer/2375416 (texto 25; CJK 12)
 * Callouts: 25 caracteres, mínimo 2 para servir.
 * Structured snippets: https://support.google.com/google-ads/answer/6280012
 *
 * Microsoft Advertising — ResponsiveSearchAd e extensões (Bing Ads API v13):
 * https://learn.microsoft.com/en-us/advertising/campaign-management-service/responsivesearchad
 * https://learn.microsoft.com/en-us/advertising/guides/entity-hierarchy-limits
 * Sitelink: texto 25 com descrições, 35 sem; descrições 35.
 * https://learn.microsoft.com/en-us/advertising/campaign-management-service/sitelinkadextension
 * Callout: 1–25, mínimo 2 por entidade.
 */

export type AdPlatform = "google" | "microsoft";

export type RsaSpec = {
  platform: AdPlatform;
  headlineMax: number;
  headlineMin: number;
  headlineMaxCount: number;
  descriptionMax: number;
  descriptionMin: number;
  descriptionMaxCount: number;
  pathMax: number;
  /** Microsoft: domínio + paths não devem passar deste total. */
  domainPlusPathsMax: number | null;
};

export const GOOGLE_RSA: RsaSpec = {
  platform: "google",
  headlineMax: 30,
  headlineMin: 3,
  headlineMaxCount: 15,
  descriptionMax: 90,
  descriptionMin: 2,
  descriptionMaxCount: 4,
  pathMax: 15,
  domainPlusPathsMax: null,
};

export const MICROSOFT_RSA: RsaSpec = {
  platform: "microsoft",
  headlineMax: 30,
  headlineMin: 3,
  headlineMaxCount: 15,
  descriptionMax: 90,
  descriptionMin: 2,
  descriptionMaxCount: 4,
  pathMax: 15,
  domainPlusPathsMax: 67,
};

export function rsaSpec(platform: AdPlatform): RsaSpec {
  return platform === "microsoft" ? MICROSOFT_RSA : GOOGLE_RSA;
}

export type SitelinkSpec = {
  textMax: number;
  textMaxWithoutDescriptions: number;
  descriptionMax: number;
  descriptionsArePair: boolean;
};

export const GOOGLE_SITELINK: SitelinkSpec = {
  textMax: 25,
  textMaxWithoutDescriptions: 25,
  descriptionMax: 35,
  descriptionsArePair: false,
};

/** Com descrições, o texto Microsoft fica em 25; sem descrições, 35. */
export const MICROSOFT_SITELINK: SitelinkSpec = {
  textMax: 25,
  textMaxWithoutDescriptions: 35,
  descriptionMax: 35,
  descriptionsArePair: true,
};

export function sitelinkSpec(platform: AdPlatform): SitelinkSpec {
  return platform === "microsoft" ? MICROSOFT_SITELINK : GOOGLE_SITELINK;
}

export const CALLOUT_MAX = 25;
export const CALLOUT_MIN_COUNT = 2;
export const SNIPPET_VALUE_MAX = 25;
export const SNIPPET_MIN_VALUES = 3;

/** Cabeçalhos oficiais do Google Ads. O Microsoft Advertising usa um conjunto próprio; valores fora da lista ficam "não suportado". */
export const GOOGLE_SNIPPET_HEADERS = [
  "Amenities",
  "Brands",
  "Courses",
  "Degree programs",
  "Destinations",
  "Featured hotels",
  "Insurance coverage",
  "Models",
  "Neighborhoods",
  "Service catalog",
  "Shows",
  "Styles",
  "Types",
] as const;

export const MICROSOFT_SNIPPET_HEADERS = [
  "Amenities",
  "Brands",
  "Courses",
  "Degree programs",
  "Destinations",
  "Featured hotels",
  "Insurance coverage",
  "Models",
  "Neighborhoods",
  "Service catalog",
  "Shows",
  "Styles",
  "Types",
] as const;
