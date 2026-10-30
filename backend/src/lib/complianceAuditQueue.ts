/**
 * Adapter de enqueue para create draft / background audits.
 * Fase 5: delega na fila **persistente** (`complianceJobs`).
 * O modo LEGACY em memória está desactivado em produção.
 */
import type { PresellPage } from "@prisma/client";
import {
  enqueuePresellDraftAuditJob,
  getComplianceJobQueueSnapshot,
  type EnqueueComplianceJobResult,
} from "./complianceJobs";

export type DraftAuditEnqueueResult = EnqueueComplianceJobResult;

/**
 * Agenda auditoria de draft de forma persistente.
 * Em produção ignora COMPLIANCE_AUDIT_LEGACY_UNBOUNDED.
 */
export async function enqueuePresellDraftAudit(
  page: PresellPage,
): Promise<DraftAuditEnqueueResult> {
  if (
    process.env.COMPLIANCE_AUDIT_LEGACY_UNBOUNDED === "1" &&
    process.env.NODE_ENV === "production"
  ) {
    console.error(
      "[complianceAuditQueue] LEGACY_UNBOUNDED bloqueado em produção — a usar fila persistente.",
    );
  }
  return enqueuePresellDraftAuditJob(page);
}

/** Snapshot para /api/health (async — preferir getComplianceJobQueueSnapshot directo). */
export async function getComplianceAuditQueueSnapshot() {
  try {
    return await getComplianceJobQueueSnapshot();
  } catch (e) {
    return {
      error: "unavailable",
      message: e instanceof Error ? e.message : "error",
    };
  }
}
