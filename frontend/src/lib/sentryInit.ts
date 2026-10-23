/**
 * Sentry opcional no frontend (VITE_SENTRY_DSN). Sem DSN = no-op.
 */
export async function initFrontendSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || "0.05"),
    });
  } catch (e) {
    console.warn("[ops] Sentry frontend indisponível", e);
  }
}
