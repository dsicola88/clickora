import { prisma } from "../paidPrisma";

import { optimizerIdempotencyHours } from "./config";

/**
 * Quando aplicar o check de idempotência na BD (flags repetem; dry-run não dedupe aqui).
 * Exportado para testes unitários alinhados ao `optimizer.service`.
 */
export function shouldApplyIdempotencyCheck(args: { decisionType: string; dryRun: boolean }): boolean {
  if (args.decisionType === "flag_creative_swap") return false;
  if (args.dryRun) return false;
  return true;
}

/** Evita repetir a mesma decisão aplicada com sucesso dentro da janela configurada. */
export async function hasRecentSuccessfulDecision(args: {
  campaignId: string;
  ruleCode: string;
  decisionType: string;
}): Promise<boolean> {
  const hours = optimizerIdempotencyHours();
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const existing = await prisma.paidAdsOptimizerDecision.findFirst({
    where: {
      campaignId: args.campaignId,
      ruleCode: args.ruleCode,
      decisionType: args.decisionType,
      executionOk: true,
      dryRun: false,
      createdAt: { gte: since },
    },
  });

  return existing != null;
}
