/** Isolamento por tenant: pesquisas nunca se consultam só por id. */
export function keywordResearchListWhere(userId: string) {
  return { userId };
}

export function keywordResearchByIdWhere(userId: string, id: string) {
  return { id, userId };
}
