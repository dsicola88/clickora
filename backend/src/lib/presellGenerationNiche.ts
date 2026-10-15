export const PRESELL_GENERATION_NICHES = ["black", "white"] as const;
export type PresellGenerationNiche = (typeof PRESELL_GENERATION_NICHES)[number];

export function normalizePresellGenerationNiche(raw: unknown): PresellGenerationNiche {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v === "white" ? "white" : "black";
}

/** Tipos desaconselhados no modo white (conversão agressiva / bridge). */
export const WHITE_NICHE_EXCLUDED_TYPE_IDS = new Set([
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

export function isPresellTypeAllowedForNiche(typeId: string, niche: PresellGenerationNiche): boolean {
  if (niche === "black") return true;
  return !WHITE_NICHE_EXCLUDED_TYPE_IDS.has(typeId);
}

export function defaultPresellTypeForNiche(niche: PresellGenerationNiche): string {
  return niche === "white" ? "tsl" : "cookies";
}

/** White: troca tipos excluídos pelo default do nicho. Black: mantém o tipo. */
export function coercePresellTypeForNiche(typeId: string, niche: PresellGenerationNiche): string {
  return isPresellTypeAllowedForNiche(typeId, niche) ? typeId : defaultPresellTypeForNiche(niche);
}
