/**
 * Acrescenta o ID do evento de clique ao URL de destino (oferta) para o postback reconhecer o clique.
 *
 * - Sempre define `clickora_click_id` (namespace próprio).
 * - Só define aliases de rede se ainda não existirem: muitas redes usam estes nomes
 *   para tokens **delas**; sobrescrever quebraria comissão.
 * - Cobertura ponta-a-ponta:
 *   - Digistore24: `cid` / `sid1`
 *   - BuyGoods: `subid` (ecoado como {SUBID} no postback)
 *   - SmartAdv: `sub3` (recomendado pela rede) e `s2` (comum em trackers)
 *   - MaxWeb / genéricos: `sub1`, `subid1`, `clickid`, `s1`
 */
export function appendClickIdToAffiliateUrl(destUrl: string, clickId: string): string {
  const aliases = [
    "cid",
    "clickid",
    "sid1",
    "subid",
    "subid1",
    "sub1",
    "sub3",
    "s1",
    "s2",
  ] as const;

  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    for (const key of aliases) {
      if (!u.searchParams.has(key)) u.searchParams.set(key, clickId);
    }
    return u.toString();
  } catch {
    const sep = destUrl.includes("?") ? "&" : "?";
    const parts = [`clickora_click_id=${encodeURIComponent(clickId)}`];
    for (const key of aliases) {
      const re = new RegExp(`(?:^|[?&])${key}=`, "i");
      if (!re.test(destUrl)) parts.push(`${key}=${encodeURIComponent(clickId)}`);
    }
    return `${destUrl}${sep}${parts.join("&")}`;
  }
}
