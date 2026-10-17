import { PRESELL_TYPE_GROUPS, type PresellTypeGroup } from "@/lib/presellTypeOptions";

export const PRESELL_GENERATION_NICHES = ["black", "white"] as const;
export type PresellGenerationNiche = (typeof PRESELL_GENERATION_NICHES)[number];

export const PRESELL_NICHE_OPTIONS: {
  id: PresellGenerationNiche;
  name: string;
  description: string;
}[] = [
  {
    id: "black",
    name: "Black (promessas fortes)",
    description:
      "Saúde, emagrecimento, desempenho e ofertas agressivas. Portal informativo Ads-safe com o nome do produto da URL (não clona claims nem cola Visivra/outro catálogo). Cookie só desbloqueia o artigo; o hoplink fica no CTA da página. Identidade do afiliado obrigatória.",
  },
  {
    id: "white",
    name: "White (produtos leves)",
    description:
      "Gadgets, reviews, ofertas sem claims médicos. Visual da página da URL (espelho) quando possível. Cookies só desbloqueiam a página; a oferta fica nos CTAs explícitos. Divulgação de afiliado no topo.",
  },
];

const WHITE_EXCLUDED = new Set([
  "fantasma",
  "sexo",
  "idade",
  "idade_sexo",
  "idade_pais",
  "sexo_pais",
  "grupo_homem",
  "grupo_mulher",
  "pais",
  "captcha",
  "modelos",
]);

export function normalizePresellGenerationNiche(raw: unknown): PresellGenerationNiche {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v === "white" ? "white" : "black";
}

export function defaultPresellTypeForNiche(niche: PresellGenerationNiche): string {
  return niche === "white" ? "tsl" : "cookies";
}

export function isPresellTypeAllowedForNiche(typeId: string, niche: PresellGenerationNiche): boolean {
  if (niche === "black") return true;
  return !WHITE_EXCLUDED.has(typeId);
}

export function presellTypeGroupsForNiche(niche: PresellGenerationNiche): PresellTypeGroup[] {
  if (niche === "black") return PRESELL_TYPE_GROUPS;
  return PRESELL_TYPE_GROUPS.map((g) => ({
    ...g,
    types: g.types.filter((t) => !WHITE_EXCLUDED.has(t.id)),
  })).filter((g) => g.types.length > 0);
}

export function coercePresellTypeForNiche(typeId: string, niche: PresellGenerationNiche): string {
  return isPresellTypeAllowedForNiche(typeId, niche) ? typeId : defaultPresellTypeForNiche(niche);
}

export type ImportedPolicyUrls = {
  privacy?: string;
  terms?: string;
  refund?: string;
  shipping?: string;
};

export { applyImportedPolicyToSettings } from "@/lib/presellFooterPolicies";

export function applyImportedSourceIdentity(
  settings: Record<string, unknown>,
  identity: { businessName?: string; contactEmail?: string } | undefined,
): Record<string, unknown> {
  if (!identity) return settings;
  const next = { ...settings };
  const name = identity.businessName?.trim();
  const email = identity.contactEmail?.trim();
  if (name) next.businessName = name;
  if (email) next.contactEmail = email;
  return next;
}

/** Segunda variante A/B — distinta da primeira, respeitando o nicho. */
export function defaultAbPresellTypeB(typeA: string, niche: PresellGenerationNiche): string {
  if (niche === "white") {
    if (typeA === "tsl") return "review";
    if (typeA === "review") return "dtc";
    if (typeA === "dtc") return "tsl";
    if (typeA === "cookies") return "tsl";
    if (typeA === "vsl") return "vsl_tsl";
    if (typeA === "vsl_tsl") return "vsl";
    return "review";
  }
  if (typeA === "cookies") return "desconto";
  if (typeA === "desconto") return "cookies";
  if (typeA === "tsl") return "review";
  if (typeA === "review") return "tsl";
  if (typeA === "dtc") return "tsl";
  if (typeA === "vsl") return "vsl_tsl";
  if (typeA === "vsl_tsl") return "vsl";
  return "tsl";
}
