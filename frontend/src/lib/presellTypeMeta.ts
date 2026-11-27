/**
 * Mapeamento tipo → página pública (`PublicPresell`):
 *
 * Render por defeito (exceto `fantasma`): `resolvePresellPageDocument` → `PublicBuilderPresellView`
 * (documento de widgets). O ramo React legado (`pageBody`) só serve o redirect fantasma.
 *
 * | Tipo        | Comportamento |
 * |-------------|----------------|
 * | cookies     | Widget `cookieBanner` no documento (barra). Aceitar = ads não essenciais; Fechar = essenciais. Compra sempre pelos CTAs `/track/r/` (UTMs/gclid). |
 * | desconto    | `DiscountPresellOverlay` (faixa + modal). CTA/fechar/fundo → oferta rastreada. |
 * | fantasma    | Redirecionamento ao primeiro movimento (rato/toque/scroll) — só black. |
 * | vsl         | Vídeo em destaque (YouTube/Bunny/MP4) que abre com controlos; sem carta longa. White+espelho: vídeo primeiro + clone. |
 * | vsl_tsl     | Combo: vídeo primeiro (abre) + espelho/carta TSL abaixo. |
 * | tsl, dtc, review, advertorial | Sem espelho: portal/artigo no documento (tema distinto). White+espelho: HTML 1:1 sem chrome Clickora por cima. |
 * | sexo, idade, idade_sexo, idade_pais, sexo_pais, grupo_*, pais, captcha, modelos | Qualificação sticky antes do CTA (só black); cliques bloqueados até validar. |
 * | segmentacao | Modal de escolha com 2 destinos (ex. Review / Página oficial); `co_seg` no tracking. |
 * | builder     | Documento do editor; white+espelho entra no fluxo comum de espelho. |
 */

/** Tipos que mostram chrome diferenciador quando o espelho HTML está activo. */
export function isMirrorChromePresellType(presellType: string): boolean {
  return (
    presellType === "tsl" ||
    presellType === "dtc" ||
    presellType === "review" ||
    presellType === "advertorial" ||
    presellType === "vsl" ||
    presellType === "vsl_tsl"
  );
}
export type PresellGateKind =
  | "none"
  | "cookies"
  | "age"
  | "sex"
  | "age_group_m"
  | "age_group_f"
  | "country"
  | "captcha"
  | "models"
  | "segmentation";

export function getPresellGateKind(presellType: string): PresellGateKind {
  switch (presellType) {
    case "cookies":
      return "cookies";
    case "idade":
      return "age";
    case "sexo":
      return "sex";
    case "grupo_homem":
      return "age_group_m";
    case "grupo_mulher":
      return "age_group_f";
    case "pais":
      return "country";
    case "captcha":
      return "captcha";
    case "modelos":
      return "models";
    case "segmentacao":
      return "segmentation";
    default:
      return "none";
  }
}

export function isVideoPresellType(presellType: string): boolean {
  return presellType === "vsl" || presellType === "vsl_tsl";
}

/** Só VSL (sem TSL): página pública não repete a carta longa abaixo do vídeo. */
export function isVslOnlyPresellType(presellType: string): boolean {
  return presellType === "vsl";
}

/** Presell com faixa de urgência + modal de desconto (valores importados da página). */
export function isDiscountPresellType(presellType: string): boolean {
  return presellType === "desconto";
}

/** Presell “fantasma” (legado): página curta com CTA; nunca navega sem clique. */
export function isGhostPresellType(presellType: string): boolean {
  return presellType === "fantasma";
}

/** Presell montada no editor visual (secções/widgets), não pelo import automático. */
export function isBuilderPresellType(presellType: string | null | undefined): boolean {
  return (presellType || "").trim().toLowerCase() === "builder";
}

/** Review / análise: CTAs levam sempre o hoplink rastreado; o rodapé fica no nível legal da origem. */
export function isReviewPresellType(presellType: string): boolean {
  return presellType === "review" || presellType === "advertorial";
}

/** Pacote SuperPresell-like: landing (tsl) + review + advertorial. */
export const PRESELL_TRIPLE_PACK_TYPES = ["tsl", "review", "advertorial"] as const;
export type PresellTriplePackType = (typeof PRESELL_TRIPLE_PACK_TYPES)[number];

/** Formulário simples ou combinado antes do CTA (exclui cookies e segmentação modal). */
export type CoreInteractivePresellGateKind = Exclude<
  PresellGateKind,
  "none" | "cookies" | "segmentation"
>;

export type CompoundInteractivePresellGateKind = "age_sex" | "age_country" | "sex_country";

export type InteractivePresellGateKind = CoreInteractivePresellGateKind | CompoundInteractivePresellGateKind;

export function getInteractiveGateKind(presellType: string): InteractivePresellGateKind | null {
  switch (presellType) {
    case "idade_sexo":
      return "age_sex";
    case "idade_pais":
      return "age_country";
    case "sexo_pais":
      return "sex_country";
    default: {
      const g = getPresellGateKind(presellType);
      /** Cookies e segmentação têm UI própria — não são formulários sticky. */
      if (g === "none" || g === "cookies" || g === "segmentation") return null;
      return g as InteractivePresellGateKind;
    }
  }
}
