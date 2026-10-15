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
      "Saúde, emagrecimento, desempenho e ofertas agressivas. Página informativa à prova de bloqueio: não clona claims da sales page. O hoplink fica no gate (cookies, desconto…) — não no corpo.",
  },
  {
    id: "white",
    name: "White (produtos leves)",
    description:
      "Gadgets, reviews, ofertas sem claims médicos. Visual fiel ao produto; políticas Google/Bing. Em cookies o hoplink fica no aviso; nos outros tipos vale o CTA do tipo. Sem fantasma nem gates de idade/sexo.",
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

export function applyImportedPolicyToSettings(
  settings: Record<string, unknown>,
  policies: ImportedPolicyUrls | undefined,
): Record<string, unknown> {
  if (!policies) return settings;
  const next = { ...settings };
  if (policies.privacy?.trim()) {
    next.cookiePolicyUrl = policies.privacy.trim();
    next.privacyPolicyUrl = policies.privacy.trim();
  }
  if (policies.terms?.trim()) {
    next.termsUrl = policies.terms.trim();
  }
  return next;
}

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
