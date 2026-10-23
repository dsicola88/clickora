/**
 * Parâmetros de clique escritos no hoplink. Cada rede só recebe os seus.
 * MaxWeb/BuyGoods: `subid` + `subid2` — a MaxWeb reescreve o lander com
 * `subid=<segmento do path>` (ex. 3986) e sessão em `subid2`; o postback
 * ecoa o que enviámos via {SUBID}/{SUBID2}. `subid2` é o canal estável
 * (padrão Voluum); `subid` fica como backup para painéis que só usam {SUBID}.
 */
const OUTBOUND: Record<string, readonly string[]> = {
  digistore24: ["cid", "sid1"],
  buygoods: ["subid", "subid2"],
  maxweb: ["subid", "subid2"],
  smartadv: ["sub3"],
  hotmart: ["src"],
  clickbank: ["tid"],
  warriorplus: ["tid"],
  jvzoo: ["tid"],
};

export function outboundClickKeys(platformId: string | null | undefined): readonly string[] {
  if (!platformId) return [];
  return OUTBOUND[platformId] || [];
}

export function platformIdFromOfferHost(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (host === "digistore24.com" || host.endsWith(".digistore24.com")) return "digistore24";
  if (host === "buygoods.com" || host.endsWith(".buygoods.com")) return "buygoods";
  if (host === "maxweb.com" || host.endsWith(".maxweb.com") || /^m\d+w\.com$/.test(host) || host.startsWith("mweb")) return "maxweb";
  if (host === "hotmart.com" || host.endsWith(".hotmart.com")) return "hotmart";
  if (host.endsWith(".clickbank.net") || host === "clickbank.net" || host.endsWith(".clickbank.com") || host === "clickbank.com") {
    return "clickbank";
  }
  if (host === "warriorplus.com" || host.endsWith(".warriorplus.com")) return "warriorplus";
  if (host === "jvzoo.com" || host.endsWith(".jvzoo.com")) return "jvzoo";
  return null;
}
