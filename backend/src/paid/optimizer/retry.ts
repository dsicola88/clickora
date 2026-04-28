/**
 * Retry com backoff exponencial para mutações nas APIs de anúncios (falhas transitórias).
 */
import { optimizerApiMaxRetries, optimizerApiRetryBaseMs } from "./config";
import { optimizerLog } from "./logger";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isLikelyTransientAdsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("econnreset") ||
    m.includes("etimedout") ||
    m.includes("socket hang up") ||
    m.includes("econnrefused") ||
    m.includes("429") ||
    m.includes("rate limit") ||
    m.includes("rate_limit") ||
    m.includes("too many requests") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504") ||
    m.includes("resource_exhausted") ||
    m.includes("temporarily unavailable") ||
    m.includes("unavailable") ||
    m.includes("internal error")
  );
}

type CrResult = { ok: true } | { ok: false; error: string };

/**
 * Repete chamadas que devolvem `{ ok, error? }` quando o erro parece transitório de rede/API.
 */
export async function retryAdsMutation(
  label: string,
  fn: () => Promise<CrResult>,
  trace: Record<string, unknown>,
): Promise<CrResult> {
  const max = optimizerApiMaxRetries();
  const base = optimizerApiRetryBaseMs();
  let last: CrResult | undefined;

  for (let attempt = 1; attempt <= max; attempt++) {
    last = await fn();
    if (last.ok) return last;
    const errMsg = last.error ?? "";
    if (attempt >= max || !isLikelyTransientAdsError(errMsg)) {
      return last;
    }
    const delay = base * 2 ** (attempt - 1) + Math.floor(Math.random() * 150);
    optimizerLog("warn", "ads_mutation_retry", {
      ...trace,
      label,
      attempt,
      maxAttempts: max,
      nextDelayMs: delay,
      errorPreview: errMsg.slice(0, 400),
    });
    await sleep(delay);
  }

  return last!;
}
