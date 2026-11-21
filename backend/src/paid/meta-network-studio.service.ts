/**
 * Acções day-to-day Meta (pause/resume/budget) via change requests — espelho fino do Google studio.
 */
import { z } from "zod";

import { submitNetworkStudioChangeRequest } from "./network-studio-submit";
import { prisma } from "./paidPrisma";

const metaStudioActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause_campaign") }),
  z.object({ action: z.literal("resume_campaign") }),
  z.object({
    action: z.literal("update_budget_usd"),
    daily_budget_usd: z.number().finite().min(1).max(1_000_000),
  }),
]);

export async function executeMetaStudioAction(
  projectId: string,
  campaignId: string,
  body: unknown,
  requestedById: string,
): Promise<
  | { ok: true; change_request: { id: string; status: string } }
  | { ok: false; error: string; change_request_id?: string }
> {
  const parsed = metaStudioActionSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Pedido inválido." };
  }

  const camp = await prisma.paidAdsCampaign.findFirst({
    where: { id: campaignId, projectId, platform: "meta_ads" },
    include: { metaAdsets: { orderBy: { createdAt: "asc" }, take: 5 } },
  });
  if (!camp) return { ok: false, error: "Campanha Meta não encontrada." };
  if (camp.status === "archived") return { ok: false, error: "Campanha arquivada." };
  if (!camp.externalCampaignId) {
    return {
      ok: false,
      error: "Publique a campanha no Meta antes de alterações ao vivo.",
    };
  }

  const submit = async (
    type: "meta_pause_entity" | "meta_resume_entity" | "meta_update_budget",
    payload: Record<string, unknown>,
  ) => {
    const r = await submitNetworkStudioChangeRequest({
      projectId,
      campaignId,
      type,
      payload,
      requestedById,
    });
    if (r.error) {
      return { ok: false as const, error: r.error, change_request_id: r.id };
    }
    return { ok: true as const, change_request: { id: r.id, status: r.status } };
  };

  const a = parsed.data;
  switch (a.action) {
    case "pause_campaign":
      return submit("meta_pause_entity", { level: "campaign", id: campaignId });
    case "resume_campaign":
      return submit("meta_resume_entity", { level: "campaign", id: campaignId });
    case "update_budget_usd": {
      const primary =
        camp.metaAdsets.find((x) => x.externalId) ?? camp.metaAdsets[0] ?? null;
      if (!primary) {
        return {
          ok: false,
          error: "Sem conjunto (ad set) local — importe ou publique a campanha Meta primeiro.",
        };
      }
      const daily_budget_cents = Math.max(100, Math.round(a.daily_budget_usd * 100));
      return submit("meta_update_budget", {
        meta_adset_id: primary.id,
        daily_budget_cents,
      });
    }
    default:
      return { ok: false, error: "Acção não suportada." };
  }
}
