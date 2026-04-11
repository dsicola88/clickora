/**
 * Logging estruturado para auditoria de isolamento (sem dados sensíveis em excesso).
 * Em produção pode ser redirecionado para Datadog / CloudWatch / etc.
 */

const PREFIX = "[tenant-isolation]";

export function logTenantViolation(kind: string, detail?: Record<string, unknown>): void {
  const payload = { kind, ...detail, ts: new Date().toISOString() };
  console.warn(PREFIX, "violation", JSON.stringify(payload));
}

export function logCrossTenantBlocked(detail: {
  model: string;
  tenantId: string;
  attemptedResource?: string;
}): void {
  console.warn(PREFIX, "blocked_cross_tenant", JSON.stringify({ ...detail, ts: new Date().toISOString() }));
}
