/**
 * Quando a conta Google do projecto muda, IDs externos da conta anterior
 * deixam de ser inventário válido — voltam a rascunho local (sem inventar métricas).
 */
import { prisma } from "./paidPrisma";

export async function detachStaleGoogleCampaignLinks(
  projectId: string,
  opts?: { keepExternalIds?: Set<string> | string[] },
): Promise<{ detached: number }> {
  const keep = new Set(
    [...(opts?.keepExternalIds ?? [])].map((id) => String(id).replace(/\D/g, "")).filter(Boolean),
  );

  const linked = await prisma.paidAdsCampaign.findMany({
    where: {
      projectId,
      platform: "google_ads",
      externalCampaignId: { not: null },
    },
    select: { id: true, externalCampaignId: true },
  });

  const toDetach = linked.filter((c) => {
    const ext = (c.externalCampaignId ?? "").replace(/\D/g, "");
    if (!ext) return true;
    if (keep.size === 0) return true;
    return !keep.has(ext);
  });

  if (toDetach.length === 0) return { detached: 0 };

  await prisma.paidAdsCampaign.updateMany({
    where: { id: { in: toDetach.map((c) => c.id) } },
    data: {
      externalCampaignId: null,
      status: "draft",
    },
  });

  return { detached: toDetach.length };
}
