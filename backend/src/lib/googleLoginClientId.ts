/**
 * Client ID do login Google (GIS / verifyIdToken).
 * Preferir GOOGLE_OAUTH_CLIENT_ID; fallback ao client Web já usado no Google Ads.
 */
export function resolveGoogleLoginClientId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const id =
    env.GOOGLE_OAUTH_CLIENT_ID?.trim() || env.GOOGLE_ADS_CLIENT_ID?.trim() || "";
  return id || null;
}
