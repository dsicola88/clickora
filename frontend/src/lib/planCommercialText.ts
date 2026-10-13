/** Espelha a regra do backend: frase livre com número de páginas, cliques ou domínios. */
const QUOTA_WORD = /cliques?|p[áa]ginas?|presells?|dom[íi]nios?/i;

export function freeTextEmbedsNumericQuota(text: string): boolean {
  return /\d/.test(text) && QUOTA_WORD.test(text);
}

export const NUMERIC_QUOTA_IN_FREE_TEXT =
  "A frase não pode trazer um número de páginas, cliques ou domínios. Esses valores vêm dos campos do plano e mudam no cartão quando os alterar.";
