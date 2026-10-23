/**
 * Barra de qualidade elite (Fase 2) — nutra/health Search (nicho black) e white.
 * Critérios objectivos antes de «pronta a anunciar», alinhados ao gate de publish.
 */

import type { PresellGenerationNiche } from "@/lib/presellGenerationNiche";
import {
  buildPublishReadinessFromPresell,
  type PublishReadinessItem,
} from "@/components/PresellPublishReadiness";

export type EliteQualityItem = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
};

export function buildEliteQualityBar(input: {
  niche: PresellGenerationNiche;
  affiliateLink?: string | null;
  mirrorHtml?: string | null;
  status?: string | null;
  customDomainId?: string | null;
  publicUrl?: string | null;
  businessName?: string | null;
  contactEmail?: string | null;
  productImagesCount?: number;
  hasAffiliateDisclosure?: boolean;
  brandKitName?: string | null;
}): { items: EliteQualityItem[]; score: number; ready: boolean } {
  const publish = buildPublishReadinessFromPresell({
    status: input.status,
    affiliateLink: input.affiliateLink,
    mirrorHtml: input.mirrorHtml,
    customDomainId: input.customDomainId,
    publicUrl: input.publicUrl,
  });

  const name = (input.businessName || input.brandKitName || "").trim();
  const email = (input.contactEmail || "").trim();
  const imgs = input.productImagesCount ?? 0;

  const nicheItems: EliteQualityItem[] =
    input.niche === "black"
      ? [
          {
            id: "identity",
            label: "Identidade do afiliado (nome + email)",
            ok: name.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
            hint: "Obrigatório em black / Google Ads — sem inventar marca.",
          },
          {
            id: "disclosure",
            label: "Divulgação de afiliado",
            ok: input.hasAffiliateDisclosure !== false,
            hint: "Disclosure no topo / settings.",
          },
          {
            id: "assets",
            label: "Imagens reais da oferta (≥ 2)",
            ok: imgs >= 2 || Boolean((input.mirrorHtml || "").length > 800),
            hint: "Import deve trazer fotos ou espelho fiel.",
          },
        ]
      : [
          {
            id: "contact",
            label: "Contacto público (email)",
            ok: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
            hint: "White: email real de suporte / operador.",
          },
          {
            id: "mirror_or_assets",
            label: "Espelho ou assets da oferta",
            ok: Boolean((input.mirrorHtml || "").length > 400) || imgs >= 1,
            hint: "Preferir espelho da sales page.",
          },
        ];

  const items: EliteQualityItem[] = [
    ...publish.map((p: PublishReadinessItem) => ({
      id: p.id,
      label: p.label,
      ok: p.ok,
      hint: p.hint,
    })),
    ...nicheItems,
  ];

  const okCount = items.filter((i) => i.ok).length;
  const score = items.length ? Math.round((okCount / items.length) * 100) : 0;
  const hardFail = items.some((i) => ["offer", "cta_track", "identity", "contact"].includes(i.id) && !i.ok);
  return { items, score, ready: score >= 85 && !hardFail };
}
