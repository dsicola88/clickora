/**
 * Acrescenta o ID do evento de clique ao URL de destino (oferta) para a rede o devolver no postback.
 */
export function appendClickIdToAffiliateUrl(destUrl: string, clickId: string): string {
  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    return u.toString();
  } catch {
    const sep = destUrl.includes("?") ? "&" : "?";
    return `${destUrl}${sep}clickora_click_id=${encodeURIComponent(clickId)}`;
  }
}
