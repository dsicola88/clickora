/**
 * POST /track/event é público (CORS aberto no lander).
 * Conversões/vendas só via postback autenticado — evita inflar `presellPage.conversions`.
 */
export function isForbiddenPublicTrackEventType(eventType: string): boolean {
  return eventType === "conversion" || eventType === "sale";
}
