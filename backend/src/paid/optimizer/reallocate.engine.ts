/**
 * Redistribuição activa de orçamento entre campanhas live da mesma rede.
 * Neutra em gasto total: corta no perdedor e soma no vencedor (mesma quantia).
 * Não inventa funil — só usa ROAS (receita tracking / gasto rede) e orçamento diário actual.
 */
import type { PaidAdsPlatform } from "@prisma/client";

import { scaleBudgetFraction, scaleRoasThreshold } from "./config";

export type ReallocateCampSnapshot = {
  campaignId: string;
  platform: PaidAdsPlatform;
  /** Gasto conhecido na janela (USD); null = sem dado de rede → excluído. */
  spendUsd: number | null;
  revenueUsd: number;
  /** Orçamento diário actual em USD (local). */
  dailyBudgetUsd: number;
  /** Elegível a pausa neste ciclo — não usar como dador nem receptor. */
  wouldPause: boolean;
};

export type ReallocateProposal = {
  ruleCode: "reallocate_budget_winner_from_laggard";
  decisionType: "reallocate_budget";
  receiverCampaignId: string;
  donorCampaignId: string;
  platform: PaidAdsPlatform;
  transferUsd: number;
  reason: string;
  inputSnapshot: Record<string, unknown>;
};

function roasOf(s: ReallocateCampSnapshot): number | null {
  if (s.spendUsd == null || !Number.isFinite(s.spendUsd) || s.spendUsd < 1e-6) return null;
  return s.revenueUsd / s.spendUsd;
}

/**
 * Uma proposta por plataforma (melhor ROAS ← pior ROAS), se o gap e os orçamentos o permitirem.
 */
export function proposeBudgetReallocations(
  camps: ReallocateCampSnapshot[],
  opts?: {
    fraction?: number;
    minRoas?: number;
    minDonorBudgetUsd?: number;
    minTransferUsd?: number;
  },
): ReallocateProposal[] {
  const fraction = opts?.fraction ?? scaleBudgetFraction();
  const minRoas = opts?.minRoas ?? scaleRoasThreshold();
  const minDonorBudgetUsd = opts?.minDonorBudgetUsd ?? 5;
  const minTransferUsd = opts?.minTransferUsd ?? 1;

  const byPlatform = new Map<PaidAdsPlatform, ReallocateCampSnapshot[]>();
  for (const c of camps) {
    if (c.wouldPause) continue;
    if (c.spendUsd == null || !Number.isFinite(c.spendUsd) || c.spendUsd < 1) continue;
    if (!(c.dailyBudgetUsd > 0) || !Number.isFinite(c.dailyBudgetUsd)) continue;
    const list = byPlatform.get(c.platform) ?? [];
    list.push(c);
    byPlatform.set(c.platform, list);
  }

  const out: ReallocateProposal[] = [];

  for (const [platform, list] of byPlatform) {
    if (list.length < 2) continue;

    const scored = list
      .map((c) => ({ c, roas: roasOf(c) }))
      .filter((x): x is { c: ReallocateCampSnapshot; roas: number } => x.roas != null);

    const receivers = scored
      .filter((x) => x.roas >= minRoas && x.c.revenueUsd > 0)
      .sort((a, b) => b.roas - a.roas || b.c.revenueUsd - a.c.revenueUsd);

    const donors = scored
      .filter((x) => x.roas < minRoas && x.c.dailyBudgetUsd >= minDonorBudgetUsd)
      .sort((a, b) => a.roas - b.roas || b.c.spendUsd! - a.c.spendUsd!);

    const receiver = receivers[0];
    const donor = donors.find((d) => d.c.campaignId !== receiver?.c.campaignId);
    if (!receiver || !donor) continue;

    const rawTransfer = donor.c.dailyBudgetUsd * fraction;
    /** Mantém pelo menos $1/dia no dador. */
    const maxTake = Math.max(0, donor.c.dailyBudgetUsd - 1);
    const transferUsd = Math.min(rawTransfer, maxTake);
    if (transferUsd < minTransferUsd) continue;

    out.push({
      ruleCode: "reallocate_budget_winner_from_laggard",
      decisionType: "reallocate_budget",
      receiverCampaignId: receiver.c.campaignId,
      donorCampaignId: donor.c.campaignId,
      platform,
      transferUsd: Math.round(transferUsd * 100) / 100,
      reason: `Redistribuir $${transferUsd.toFixed(2)}/dia de campanha fraca (ROAS ${donor.roas.toFixed(2)}) para vencedora (ROAS ${receiver.roas.toFixed(2)}) — gasto total inalterado.`,
      inputSnapshot: {
        receiverCampaignId: receiver.c.campaignId,
        donorCampaignId: donor.c.campaignId,
        receiverRoas: receiver.roas,
        donorRoas: donor.roas,
        transferUsd: Math.round(transferUsd * 100) / 100,
        fraction,
        minRoas,
        receiverDailyBudgetUsd: receiver.c.dailyBudgetUsd,
        donorDailyBudgetUsd: donor.c.dailyBudgetUsd,
        receiverSpendUsd: receiver.c.spendUsd,
        donorSpendUsd: donor.c.spendUsd,
        receiverRevenueUsd: receiver.c.revenueUsd,
        donorRevenueUsd: donor.c.revenueUsd,
      },
    });
  }

  return out;
}
