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
  /** false = página limpa sem rodapé POLICIES — identidade deixa de ser hard-fail. */
  showAffiliateTrustFooter?: boolean;
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
  const trustFooterOn = input.showAffiliateTrustFooter !== false;

  const nicheItems: EliteQualityItem[] =
    input.niche === "black"
      ? [
          {
            id: "identity",
            label: trustFooterOn
              ? "Identidade do afiliado (nome + email)"
              : "Identidade do afiliado (opcional — rodapé desligado)",
            ok: trustFooterOn
              ? name.length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
              : true,
            hint: trustFooterOn
              ? "Obrigatório com o rodapé ligado — sem inventar marca."
              : "Rodapé de políticas desligado: página limpa.",
          },
          {
            id: "disclosure",
            label: trustFooterOn
              ? "Divulgação de afiliado"
              : "Divulgação de afiliado (opcional — rodapé desligado)",
            ok: trustFooterOn ? input.hasAffiliateDisclosure !== false : true,
            hint: trustFooterOn
              ? "Disclosure no rodapé / settings."
              : "Rodapé desligado: divulgação no bloco POLICIES não é exigida.",
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
            label: trustFooterOn
              ? "Contacto público (email)"
              : "Contacto público (opcional — rodapé desligado)",
            ok: trustFooterOn ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : true,
            hint: trustFooterOn
              ? "White: email real de suporte / operador."
              : "Rodapé desligado: contacto no rodapé não é exigido.",
          },
          {
            id: "mirror_or_assets",
            label: "Espelho ou assets da oferta",
            ok: Boolean((input.mirrorHtml || "").length > 400) || imgs >= 1,
            hint: "Preferir espelho da sales page.",
          },
        ];

  const mirrorLen = (input.mirrorHtml || "").length;
  const structureOk =
    input.niche === "black"
      ? imgs >= 1 || mirrorLen > 400 || Boolean(name)
      : mirrorLen > 400 || imgs >= 1 || Boolean((input.affiliateLink || "").trim());
  /** Página leve Ads: rodapé off OU espelho controlado (&lt; 1.2MB) — alinhado a LCP. */
  const perfLiteOk = !trustFooterOn || mirrorLen === 0 || mirrorLen < 1_200_000;

  const items: EliteQualityItem[] = [
    ...publish.map((p: PublishReadinessItem) => ({
      id: p.id,
      label: p.label,
      ok: p.ok,
      hint: p.hint,
    })),
    ...nicheItems,
    {
      id: "structure",
      label: "Estrutura profissional (hero/artigo ou espelho)",
      ok: structureOk,
      hint: "White: espelho ou assets; black: portal com marca/fotos.",
    },
    {
      id: "perf_lite",
      label: "Peso leve (LCP)",
      ok: perfLiteOk,
      hint: trustFooterOn
        ? "Espelho muito grande atrasa LCP — exporte HTML ou desligue chrome extra."
        : "Rodapé limpo: página mais leve para Ads.",
    },
  ];

  const okCount = items.filter((i) => i.ok).length;
  const score = items.length ? Math.round((okCount / items.length) * 100) : 0;
  const hardFail = items.some((i) => ["offer", "cta_track", "identity", "contact"].includes(i.id) && !i.ok);
  return { items, score, ready: score >= 85 && !hardFail };
}
