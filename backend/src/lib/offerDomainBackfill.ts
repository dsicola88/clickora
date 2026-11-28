import { systemPrisma } from "./prisma";
import { affiliateLinkFromPresellPage } from "./trackOfferRedirectGuard";
import { detectOfferNetwork } from "./offerValidation";

export type LegacyOfferCandidate = {
  name: string;
  hoplinkUrl: string;
  network: string | null;
};

export function extractLegacyOfferCandidate(input: {
  title?: string | null;
  content: unknown;
  tracking: unknown;
  networkHint?: string | null;
}): LegacyOfferCandidate | null {
  const hoplink = affiliateLinkFromPresellPage(input.content, input.tracking);
  if (!hoplink || hoplink === "#" || !/^https?:\/\//i.test(hoplink)) {
    return null;
  }
  const cleanName = (input.title || "").trim().slice(0, 200) || "Oferta importada";
  const network = detectOfferNetwork(hoplink, input.networkHint);
  return {
    name: cleanName,
    hoplinkUrl: hoplink,
    network,
  };
}

export function planPresellPrimaryBindingBackfill(input: {
  presellId: string;
  customDomainId: string | null;
  accountDomains: Array<{
    id: string;
    status: string;
    purpose: string;
    isDefault: boolean;
  }>;
}): {
  presellId: string;
  customDomainId: string;
  role: "primary";
  priority: number;
  isActive: boolean;
} | null {
  // Presell sem domínio explícito segue o domínio default da conta: criar binding congelaria
  // o default atual e quebraria essa semântica quando o dono trocar de domínio principal.
  if (!input.customDomainId) return null;
  const chosen = input.accountDomains.find(
    (d) => d.id === input.customDomainId && d.status === "verified" && d.purpose !== "tracking",
  );
  if (!chosen) return null;
  return {
    presellId: input.presellId,
    customDomainId: chosen.id,
    role: "primary",
    priority: 10,
    isActive: true,
  };
}

/**
 * Backfill idempotente em aplicação para uma conta específica (útil pós-deploy ou diagnóstico).
 * Nunca apaga nem sobrescreve campos legados (`affiliateLink`, `offerUrl`, `customDomainId`).
 */
export async function backfillAccountOffersAndDomainBindings(userId: string): Promise<{
  offersCreated: number;
  presellsLinked: number;
  campaignsLinked: number;
  bindingsCreated: number;
}> {
  let offersCreated = 0;
  let presellsLinked = 0;
  let campaignsLinked = 0;
  let bindingsCreated = 0;

  const [pages, campaigns, domains, existingOffers] = await Promise.all([
    systemPrisma.presellPage.findMany({
      where: { userId },
      select: { id: true, title: true, content: true, tracking: true, customDomainId: true, offerId: true },
    }),
    systemPrisma.affiliateCampaign.findMany({
      where: { userId },
      select: { id: true, name: true, offerUrl: true, platform: true, presellId: true, offerId: true },
    }),
    systemPrisma.customDomain.findMany({
      where: { userId },
      select: { id: true, status: true, purpose: true, isDefault: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    systemPrisma.offer.findMany({
      where: { userId },
      select: { id: true, hoplinkUrl: true },
    }),
  ]);

  const offerByUrl = new Map(existingOffers.map((o) => [o.hoplinkUrl.trim(), o.id]));

  for (const page of pages) {
    const campHint = campaigns.find((c) => c.presellId === page.id)?.platform ?? null;
    if (!page.offerId) {
      const candidate = extractLegacyOfferCandidate({
        title: page.title,
        content: page.content,
        tracking: page.tracking,
        networkHint: campHint,
      });
      if (candidate) {
        let offerId = offerByUrl.get(candidate.hoplinkUrl);
        if (!offerId) {
          const created = await systemPrisma.offer.create({
            data: {
              userId,
              name: candidate.name,
              network: candidate.network,
              hoplinkUrl: candidate.hoplinkUrl,
              validationStatus: "unchecked",
              compliancePassed: false,
              isActive: true,
            },
          });
          offerId = created.id;
          offerByUrl.set(candidate.hoplinkUrl, offerId);
          offersCreated += 1;
        }
        await systemPrisma.presellPage.update({
          where: { id: page.id },
          data: { offerId },
        });
        presellsLinked += 1;
      }
    }

    const existingBindingCount = await systemPrisma.presellDomainBinding.count({
      where: { presellId: page.id, userId },
    });
    if (existingBindingCount === 0) {
      const plan = planPresellPrimaryBindingBackfill({
        presellId: page.id,
        customDomainId: page.customDomainId,
        accountDomains: domains,
      });
      if (plan) {
        await systemPrisma.presellDomainBinding.create({
          data: {
            userId,
            presellId: plan.presellId,
            customDomainId: plan.customDomainId,
            role: plan.role,
            priority: plan.priority,
            isActive: plan.isActive,
          },
        });
        bindingsCreated += 1;
      }
    }
  }

  for (const camp of campaigns) {
    if (camp.offerId) continue;
    const rawUrl = (camp.offerUrl || "").trim();
    if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
      let offerId = offerByUrl.get(rawUrl);
      if (!offerId) {
        const created = await systemPrisma.offer.create({
          data: {
            userId,
            name: camp.name.slice(0, 200) || "Oferta de campanha",
            network: detectOfferNetwork(rawUrl, camp.platform),
            hoplinkUrl: rawUrl,
            validationStatus: "unchecked",
            compliancePassed: false,
            isActive: true,
          },
        });
        offerId = created.id;
        offerByUrl.set(rawUrl, offerId);
        offersCreated += 1;
      }
      await systemPrisma.affiliateCampaign.update({
        where: { id: camp.id },
        data: { offerId },
      });
      campaignsLinked += 1;
    } else if (camp.presellId) {
      const linkedPage = await systemPrisma.presellPage.findUnique({
        where: { id: camp.presellId },
        select: { offerId: true },
      });
      if (linkedPage?.offerId) {
        await systemPrisma.affiliateCampaign.update({
          where: { id: camp.id },
          data: { offerId: linkedPage.offerId },
        });
        campaignsLinked += 1;
      }
    }
  }

  return { offersCreated, presellsLinked, campaignsLinked, bindingsCreated };
}
