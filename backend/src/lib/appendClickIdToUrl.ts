/**
 * Acrescenta o ID do evento de clique ao URL de destino (oferta) para o postback reconhecer o clique.
 *
 * - Sempre define `clickora_click_id` (namespace próprio).
 * - Só define `cid` / `clickid` se ainda não existirem no destino: muitas redes usam estes nomes
 *   para o token **delas**; sobrescrever quebraria comissão.
 */
export function appendClickIdToAffiliateUrl(destUrl: string, clickId: string): string {
  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    if (!u.searchParams.has("cid")) u.searchParams.set("cid", clickId);
    if (!u.searchParams.has("clickid")) u.searchParams.set("clickid", clickId);
    return u.toString();
  } catch {
    const hasCid = /(?:^|[?&])cid=/i.test(destUrl);
    const hasClickid = /(?:^|[?&])clickid=/i.test(destUrl);
    const sep = destUrl.includes("?") ? "&" : "?";
    const parts = [`clickora_click_id=${encodeURIComponent(clickId)}`];
    if (!hasCid) parts.push(`cid=${encodeURIComponent(clickId)}`);
    if (!hasClickid) parts.push(`clickid=${encodeURIComponent(clickId)}`);
    return `${destUrl}${sep}${parts.join("&")}`;
  }
}
