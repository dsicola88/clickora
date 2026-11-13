/**
 * Mapeamento tipo → página pública (`PublicPresell`):
 *
 * Render por defeito (exceto `fantasma`): `resolvePresellPageDocument` → `PublicBuilderPresellView`
 * (documento de widgets). O ramo React legado (`pageBody`) só serve o redirect fantasma.
 *
 * | Tipo        | Comportamento |
 * |-------------|----------------|
 * | cookies     | Widget `cookieBanner` no documento; `settings.cookieRedirectToOffer`: Aceitar/Fechar → oferta rastreada, senão só libera a página. CTAs da página ficam activos. |
 * | desconto    | `DiscountPresellOverlay` (faixa + modal). CTA/fechar/fundo → oferta rastreada. |
 * | fantasma    | Redirecionamento ao primeiro movimento (rato/toque/scroll) — só black. |
 * | vsl         | Vídeo em destaque no documento; sem carta longa. White+espelho: clone + secção vídeo se `video_url`. |
 * | vsl_tsl     | Vídeo + carta/artigo editorial no documento (ou espelho + vídeo). |
 * | tsl, dtc, review, advertorial | Sem espelho: portal/artigo no documento (tema distinto). White+espelho: HTML 1:1 sem chrome Clickora por cima. |
 * | sexo, idade, idade_sexo, idade_pais, sexo_pais, grupo_*, pais, captcha, modelos | Qualificação sticky antes do CTA (só black); cliques bloqueados até validar. |
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
  | "models";

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

/** Presell “fantasma”: redireciona ao primeiro movimento do rato/toque/scroll. */
export function isGhostPresellType(presellType: string): boolean {
  return presellType === "fantasma";
}

/** Presell montada no editor visual (secções/widgets), não pelo import automático. */
export function isBuilderPresellType(presellType: string): boolean {
  return presellType === "builder";
}

/** Review / análise: CTAs levam sempre o hoplink rastreado; o rodapé fica no nível legal da origem. */
export function isReviewPresellType(presellType: string): boolean {
  return presellType === "review" || presellType === "advertorial";
}

/** Pacote SuperPresell-like: landing (tsl) + review + advertorial. */
export const PRESELL_TRIPLE_PACK_TYPES = ["tsl", "review", "advertorial"] as const;
export type PresellTriplePackType = (typeof PRESELL_TRIPLE_PACK_TYPES)[number];

/** Formulário simples ou combinado antes do CTA. */
export type CoreInteractivePresellGateKind = Exclude<PresellGateKind, "none" | "cookies">;

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
      if (g === "none" || g === "cookies") return null;
      return g as InteractivePresellGateKind;
    }
  }
}
