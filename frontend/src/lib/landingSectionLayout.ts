/** Secções reordenáveis da landing (entre intro e rodapé legal). */

/** Lista fixa (usada em ordem por defeito e no editor). */
export const LANDING_SECTION_IDS = [
  "content_blocks",
  "features",
  "stats",
  "testimonials",
  "gallery",
  "planos",
  "faq",
] as const;

export type LandingSectionId = (typeof LANDING_SECTION_IDS)[number];

export const LANDING_SECTION_LABELS: Record<LandingSectionId, string> = {
  content_blocks: "Blocos de vídeo / imagem",
  features: "Destaques (3 cartões)",
  stats: "Números / estatísticas",
  testimonials: "Testemunhos em vídeo",
  gallery: "Galeria de imagens",
  planos: "Planos e preços",
  faq: "FAQ",
};

export const DEFAULT_LANDING_SECTION_ORDER: LandingSectionId[] = [
  ...LANDING_SECTION_IDS,
];

export function resolveSectionOrder(raw: string[] | null | undefined): LandingSectionId[] {
  const valid = new Set<string>(LANDING_SECTION_IDS);
  if (!raw?.length) return [...DEFAULT_LANDING_SECTION_ORDER];
  const seen = new Set<string>();
  const out: LandingSectionId[] = [];
  for (const id of raw) {
    if (valid.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id as LandingSectionId);
    }
  }
  for (const id of DEFAULT_LANDING_SECTION_ORDER) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export type SectionsEnabledState = Record<LandingSectionId, boolean>;

export function resolveSectionsEnabled(
  raw: Partial<Record<LandingSectionId, boolean>> | null | undefined,
): SectionsEnabledState {
  return {
    content_blocks: raw?.content_blocks !== false,
    features: raw?.features !== false,
    stats: raw?.stats !== false,
    testimonials: raw?.testimonials !== false,
    gallery: raw?.gallery !== false,
    planos: raw?.planos !== false,
    faq: raw?.faq !== false,
  };
}
