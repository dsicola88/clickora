/**
 * Mapeamento tipo → página pública (`PublicPresell`):
 *
 * | Tipo        | Comportamento |
 * |-------------|----------------|
 * | cookies     | Modal de cookies; cliques redirecionam para o link da presell. |
 * | desconto    | Faixa de urgência + modal de desconto sobre o conteúdo. |
 * | fantasma    | Redirecionamento ao primeiro movimento (rato/toque/scroll). |
 * | vsl / vsl_tsl | Vídeo ou fallback no layout React; com espelho importado, o espelho substitui esse hero (regras cookies/desconto/fantasma mantêm-se). |
 * | tsl, dtc, review | Layout padrão (hero claro) com texto e imagens importados; com espelho importado, o iframe substitui esse bloco mantendo overlays e gates. |
 * | sexo, idade, idade_sexo, idade_pais, sexo_pais, grupo_*, pais, captcha, modelos | Qualificação antes do CTA; com espelho HTML o formulário fica fixo no topo e os cliques no clone ficam bloqueados até validar. |
 * | builder     | Editor visual; se existir espelho importado (`importMirrorSrcDoc`), usa-se o espelho com as regras abaixo. |
 */
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
