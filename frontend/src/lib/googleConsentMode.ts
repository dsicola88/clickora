/**
 * Google Consent Mode v2 — defaults/update antes de tags Ads/GA.
 * Só afecta sinais gtag/dataLayer; não bloqueia tracking essencial Clickora.
 */

export type GoogleConsentSignalState = "granted" | "denied";

export type GoogleConsentSignals = {
  ad_storage: GoogleConsentSignalState;
  ad_user_data: GoogleConsentSignalState;
  ad_personalization: GoogleConsentSignalState;
  analytics_storage: GoogleConsentSignalState;
};

type GcmWindow = Window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
  gtag?: (...args: unknown[]) => void;
  __clickoraGcmDefaultsApplied?: boolean;
};

function gcmWindow(): GcmWindow {
  return window as GcmWindow;
}

export function signalsForMarketingConsent(allowed: boolean): GoogleConsentSignals {
  const v: GoogleConsentSignalState = allowed ? "granted" : "denied";
  return {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v,
  };
}

function ensureGtagStub(): void {
  if (typeof window === "undefined") return;
  const w = gcmWindow();
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag === "function") return;
  w.gtag = function gtag(...args: unknown[]) {
    w.dataLayer!.push(args);
  };
}

/**
 * Defaults o mais cedo possível (antes de inject de marketing).
 * Em páginas com gate de cookies: denied + wait_for_update.
 * Idempotente por página (flag em window).
 */
export function ensureGoogleConsentModeDefaults(opts?: {
  defaultDenied?: boolean;
  waitForUpdateMs?: number;
}): void {
  if (typeof window === "undefined") return;
  const w = gcmWindow();
  if (w.__clickoraGcmDefaultsApplied) return;
  ensureGtagStub();
  const denied = opts?.defaultDenied !== false;
  const signals = signalsForMarketingConsent(!denied);
  const wait = Math.max(0, opts?.waitForUpdateMs ?? 500);
  w.gtag!("consent", "default", {
    ...signals,
    wait_for_update: wait,
  });
  w.__clickoraGcmDefaultsApplied = true;
}

/** Depois da escolha do visitante (Aceitar / Fechar / reopen→nova escolha). */
export function updateGoogleConsentMode(allowed: boolean): void {
  if (typeof window === "undefined") return;
  ensureGtagStub();
  const w = gcmWindow();
  if (!w.__clickoraGcmDefaultsApplied) {
    ensureGoogleConsentModeDefaults({ defaultDenied: true });
  }
  w.gtag!("consent", "update", signalsForMarketingConsent(allowed));
}

/** Testes / navegação SPA entre presells. */
export function resetGoogleConsentModeForTests(): void {
  if (typeof window === "undefined") return;
  delete gcmWindow().__clickoraGcmDefaultsApplied;
}
