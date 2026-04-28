/**
 * Configuração do motor Paid Ads Optimizer V0 (env).
 * PAID_OPTIMIZER_ENABLED=true para activar o cron no servidor.
 */

export function optimizerEnabled(): boolean {
  return process.env.PAID_OPTIMIZER_ENABLED?.trim() === "true";
}

export function optimizerDryRun(): boolean {
  const v = process.env.PAID_OPTIMIZER_DRY_RUN?.trim();
  if (v === "false") return false;
  return true;
}

/** Intervalo do ciclo em ms (predef.: 15 min). */
export function optimizerIntervalMs(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_INTERVAL_MS);
  if (Number.isFinite(raw) && raw >= 60_000) return raw;
  return 900_000;
}

/** Janela de observação para tracking e conversões (horas). */
export function optimizerLookbackHours(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_LOOKBACK_HOURS);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 168) return raw;
  return 48;
}

/** Regra pause: gasto mínimo em USD (Google Ads API). */
export function pauseSpendUsdThreshold(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_PAUSE_SPEND_USD);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 10;
}

/** ROAS mínimo para escalar orçamento (+20%). */
export function scaleRoasThreshold(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_SCALE_ROAS_MIN);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 2;
}

/** CTR mínimo; abaixo disto marca flag de troca de criativo (tracking). */
export function ctrLowThreshold(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_CTR_LOW);
  if (Number.isFinite(raw) && raw > 0 && raw < 1) return raw;
  return 0.01;
}

/** Percentagem de aumento de orçamento ao escalar (ex.: 0.2 = +20%). */
export function scaleBudgetFraction(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_SCALE_BUDGET_FRACTION);
  if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw;
  return 0.2;
}

/** Expressão cron (node-cron) para o ciclo do optimizer — predef.: a cada 15 min. */
export function optimizerCronExpression(): string {
  const raw = process.env.PAID_OPTIMIZER_CRON?.trim();
  if (raw && raw.length >= 9) return raw;
  return "*/15 * * * *";
}

/**
 * Fase de rollout das regras: `pause_only` (Fase 1 — só auto-pausa) ou `all` (pausa + escala + flags).
 */
export function optimizerRulesPhase(): "pause_only" | "all" {
  return process.env.PAID_OPTIMIZER_RULES?.trim() === "all" ? "all" : "pause_only";
}

/** Horas para não repetir a mesma acção bem-sucedida (idempotência). */
export function optimizerIdempotencyHours(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_IDEMPOTENCY_HOURS);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 168) return raw;
  return 6;
}

/** Tentativas por mutação nas APIs Google/Meta/TikTok (falhas transitórias). Predef.: 3 */
export function optimizerApiMaxRetries(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_API_RETRIES);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 8) return Math.floor(raw);
  return 3;
}

/** Base em ms para backoff exponencial entre retries. Predef.: 500 */
export function optimizerApiRetryBaseMs(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_API_RETRY_BASE_MS);
  if (Number.isFinite(raw) && raw >= 100 && raw <= 30_000) return Math.floor(raw);
  return 500;
}

/** Se um ciclo ainda estiver a correr, não iniciar outro (evita sobrecarga em ticks lentos). Predef.: true */
export function optimizerSkipOverlappingTicks(): boolean {
  const v = process.env.PAID_OPTIMIZER_SKIP_OVERLAP?.trim();
  if (v === "false") return false;
  return true;
}

/** URL HTTPS para alertas JSON (Slack Incoming / Zapier / hook interno). Opcional — sem URL, não envia. */
export function optimizerAlertWebhookUrl(): string | null {
  const u = process.env.PAID_OPTIMIZER_ALERT_WEBHOOK_URL?.trim();
  if (!u || (!u.startsWith("https://") && !u.startsWith("http://"))) return null;
  return u;
}

/** Timeout por pedido de webhook de alerta (ms). Predef.: 8000 */
export function optimizerAlertWebhookTimeoutMs(): number {
  const raw = Number(process.env.PAID_OPTIMIZER_ALERT_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 2000 && raw <= 60000) return Math.floor(raw);
  return 8000;
}

/**
 * `json` — corpo = payload completo (predef.).
 * `slack_text` — legado Incoming Webhooks Slack (`{"text":"..."}` em mrkdwn).
 */
export function optimizerAlertFormat(): "json" | "slack_text" {
  return process.env.PAID_OPTIMIZER_ALERT_FORMAT?.trim().toLowerCase() === "slack_text" ? "slack_text" : "json";
}
