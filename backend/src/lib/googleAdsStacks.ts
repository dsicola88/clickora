/**
 * Fronteira explícita das duas stacks Google Ads (não unificar sem desenho).
 * Ver docs/GOOGLE_ADS_STACKS.md.
 *
 * - Afiliado / conversões / métricas: `modules/googleAds/*`
 * - Paid Autopilot (campanhas): `paid/google-ads.*` + optimizer
 *
 * Este módulo só documenta e reexporta entrypoints afiliado usados pela API de integrações.
 * Paid continua a importar de `paid/` directamente.
 */
export {
  bootstrapGoogleAdsAfterOAuth,
  getGoogleAdsApiClientConfigFromEnv,
  isGoogleAdsClickUploadReadyForUser,
  isGoogleAdsMetricsReadyForUser,
  restateConversionToGoogleAds,
  retractConversionFromGoogleAds,
  syncDirectGclidConversionToGoogleAds,
} from "../modules/googleAds/googleAds.service";
