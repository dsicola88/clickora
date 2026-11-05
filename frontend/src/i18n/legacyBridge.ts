import type { AppLocale } from "./types";
import ptEn from "./legacy/pt-en.json";
import ptEs from "./legacy/pt-es.json";
import { phraseFallbackEn, phraseFallbackEs } from "./phraseFallback";

const enMap = ptEn as Record<string, string>;
const esMap = ptEs as Record<string, string>;

function looksPortuguese(text: string): boolean {
  return /[ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ]/.test(text)
    || /\b(carregar|actualizar|atualizar|eliminar|guardar|cancelar|voltar|campanha|cliques|receita|definiç|pesquisar|presell|rotador|páginas?|resultados?)\b/i.test(text);
}

/** Light PT-PT → PT-BR orthography for leftover chrome (exact map still preferred). */
const PT_TO_BR: Array<[RegExp, string]> = [
  [/\bGuardar\b/g, "Salvar"],
  [/\bguardar\b/g, "salvar"],
  [/\bActualizar\b/g, "Atualizar"],
  [/\bactualizar\b/g, "atualizar"],
  [/\bA carregar\b/g, "Carregando"],
  [/\ba carregar\b/g, "carregando"],
  [/\bEliminar\b/g, "Excluir"],
  [/\beliminar\b/g, "excluir"],
  [/\bTelemóvel\b/g, "Celular"],
  [/\btelemóvel\b/g, "celular"],
  [/\bDefinições\b/g, "Configurações"],
  [/\bdefinições\b/g, "configurações"],
  [/\bUtilizador\b/g, "Usuário"],
  [/\butilizador\b/g, "usuário"],
  [/\bAutenticação\b/g, "Autenticação"],
];

function toPtBR(text: string): string {
  let s = text;
  for (const [re, rep] of PT_TO_BR) s = s.replace(re, rep);
  return s;
}

/**
 * Translate a Portuguese UI literal for the active locale.
 * Message-key `t()` remains preferred for new UI; this covers legacy hardcoded PT.
 */
export function translateLegacyPt(locale: AppLocale, text: string): string {
  if (!text || typeof text !== "string") return text;
  const trimmed = text;
  if (locale === "pt") return trimmed;
  if (locale === "pt-BR") return toPtBR(trimmed);
  if (locale === "es") {
    const hit = esMap[trimmed] ?? enMap[trimmed];
    if (hit) return hit;
    if (!looksPortuguese(trimmed)) return trimmed;
    const phrased = phraseFallbackEs(trimmed);
    return phrased !== trimmed ? phrased : phraseFallbackEn(trimmed);
  }
  const hit = enMap[trimmed];
  if (hit) return hit;
  if (!looksPortuguese(trimmed)) return trimmed;
  return phraseFallbackEn(trimmed);
}
