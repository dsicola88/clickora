/**
 * Mapeamento tipo → página pública (`PublicPresell`):
 *
 * | Tipo        | Comportamento |
 * |-------------|----------------|
 * | cookies     | Modal de cookies; cliques redirecionam para o link da presell. |
 * | desconto    | Faixa de urgência + modal de desconto sobre o conteúdo. |
 * | fantasma    | Redirecionamento ao primeiro movimento (rato/toque/scroll). |
 * | vsl         | Layout VSL (fundo escuro): vídeo ou fallback; CTA; sem secção de carta longa abaixo. |
 * | vsl_tsl     | Mesmo hero VSL + secção TSL abaixo (texto importado completo, CTA intercalado). |
 * | tsl, dtc, review | Layout padrão (hero claro): texto e imagens importados. |
 * | sexo, idade, grupo_*, pais, captcha, modelos | Formulário antes do CTA; CTA só ativo com dados válidos. |
 * | builder     | Layout do editor visual (`content.pageDocument`); sem gate automático. |
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

/** Tipos que exibem formulário antes do CTA (idade, sexo, país, etc.). */
export type InteractivePresellGateKind = Exclude<PresellGateKind, "none" | "cookies">;

export function getInteractiveGateKind(presellType: string): InteractivePresellGateKind | null {
  const g = getPresellGateKind(presellType);
  if (g === "none" || g === "cookies") return null;
  return g;
}
