/**
 * Acrescenta o ID do evento de clique ao URL de destino (oferta) para a rede o devolver no postback.
 * Inclui aliases comuns em trackers tipo Voluum (`cid`, `clickid`) além de `clickora_click_id`.
 */
export function appendClickIdToAffiliateUrl(destUrl: string, clickId: string): string {
  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    u.searchParams.set("cid", clickId);
    u.searchParams.set("clickid", clickId);
    return u.toString();
  } catch {
    const sep = destUrl.includes("?") ? "&" : "?";
    const q = [
      `clickora_click_id=${encodeURIComponent(clickId)}`,
      `cid=${encodeURIComponent(clickId)}`,
      `clickid=${encodeURIComponent(clickId)}`,
    ].join("&");
    return `${destUrl}${sep}${q}`;
  }
}
