import { isGoogleAdsOAuthConfigured } from "./google-ads.api";
import { getPublicApiBase } from "./paidOauthEnv";

/**
 * Em produção, regista no log o que falta para callbacks OAuth (Google) e retorno ao site.
 * Não bloqueia o arranque.
 */
export function logPaidEnvStatus(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const missing: string[] = [];

  if (isGoogleAdsOAuthConfigured()) {
    if (!getPublicApiBase() && !process.env.GOOGLE_OAUTH_REDIRECT_URL?.trim()) {
      missing.push(
        "PUBLIC_API_URL (ou API_PUBLIC_URL) para URL de callback Google, ou GOOGLE_OAUTH_REDIRECT_URL completo",
      );
    }
  }

  if (process.env.META_APP_ID && !process.env.META_APP_SECRET) {
    missing.push("META_APP_SECRET (par com META_APP_ID para OAuth Meta)");
  }
  if (process.env.META_APP_SECRET && !process.env.META_APP_ID) {
    missing.push("META_APP_ID (par com META_APP_SECRET para OAuth Meta)");
  }

  if (!process.env.PAID_OAUTH_FRONTEND_RETURN_URL?.trim() && !process.env.FRONTEND_URL?.trim()) {
    missing.push("PAID_OAUTH_FRONTEND_RETURN_URL ou FRONTEND_URL — redirect do browser após OAuth");
  }

  if (missing.length) {
    console.warn(
      "[paid-ads] Aviso de configuração (recomendado corrigir):\n  - " + missing.join("\n  - "),
    );
  }
}
