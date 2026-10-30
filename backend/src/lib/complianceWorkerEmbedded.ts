/**
 * Worker embutido no processo API — só para desenvolvimento / testes locais.
 * Produção: serviço separado (`npm run worker:compliance`).
 */
import {
  claimNextComplianceJob,
  newComplianceWorkerId,
  processClaimedComplianceJob,
  reclaimExpiredLeases,
  recoverStuckCheckingPages,
} from "./complianceJobs";

let started = false;
let accepting = true;
let inFlight = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const workerId = newComplianceWorkerId("api-embed");

function shouldEmbed(): boolean {
  if (process.env.COMPLIANCE_WORKER_EMBEDDED === "0") return false;
  if (process.env.COMPLIANCE_WORKER_EMBEDDED === "1") return true;
  // Por defeito: embutir fora de produção para DX / regressões locais
  return process.env.NODE_ENV !== "production";
}

export function isEmbeddedComplianceWorkerConfigured(): boolean {
  return shouldEmbed();
}

export function isEmbeddedComplianceWorkerRunning(): boolean {
  return started && Boolean(timer);
}

export function startEmbeddedComplianceWorker(): void {
  if (started || !shouldEmbed()) return;
  started = true;
  const concurrency = Math.max(
    1,
    Math.min(4, Number(process.env.COMPLIANCE_AUDIT_CONCURRENCY || "2") || 2),
  );
  const pollMs = Math.max(100, Number(process.env.COMPLIANCE_WORKER_POLL_MS || "400") || 400);
  console.info("[complianceWorker.embed] activo", { workerId, concurrency, pollMs });

  let lastReclaim = 0;
  timer = setInterval(() => {
    if (!accepting) return;
    void (async () => {
      const now = Date.now();
      if (now - lastReclaim > 30_000) {
        lastReclaim = now;
        try {
          await reclaimExpiredLeases();
          await recoverStuckCheckingPages({ olderThanMinutes: 20 });
        } catch {
          /* ignore */
        }
      }
      while (inFlight < concurrency) {
        const job = await claimNextComplianceJob(workerId);
        if (!job) break;
        inFlight += 1;
        void processClaimedComplianceJob(job).finally(() => {
          inFlight = Math.max(0, inFlight - 1);
        });
      }
    })().catch(() => undefined);
  }, pollMs);
  timer.unref?.();
}

export async function stopEmbeddedComplianceWorker(waitMs = 10_000): Promise<void> {
  accepting = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const deadline = Date.now() + waitMs;
  while (inFlight > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
}
