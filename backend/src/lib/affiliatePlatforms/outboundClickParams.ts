/**
 * Parâmetros de clique escritos no hoplink. Cada rede só recebe os seus.
 *
 * MaxWeb/BuyGoods: `subid` + `subid2` — a MaxWeb reescreve o lander com
 * `subid=<segmento do path>` (ex. 3986); {SUBID2} é o canal estável (Voluum).
 * Digistore24: `cid` + `sid1` — se outro tracker já ocupa `cid`, o UUID fica em `sid1`.
 * Hotmart: `src` + `sck` (backup nativo).
 * Domínio desconhecido: `subid` + `subid1` + `subid2` (redes CPA típicas).
 */
export const AFFILIATE_OUTBOUND_CLICK_KEYS: Record<string, readonly string[]> = {
  digistore24: ["cid", "sid1"],
  buygoods: ["subid", "subid2"],
  maxweb: ["subid", "subid2"],
  smartadv: ["sub3"],
  hotmart: ["src", "sck"],
  clickbank: ["tid"],
  warriorplus: ["tid"],
  jvzoo: ["tid"],
  /** BR / CPA com macros documentadas no catálogo FE (documented_s2s). */
  monetizze: ["src", "sck"],
  braip: ["xcod"],
  adcombo: ["clickid"],
  everflow: ["sub1"],
  eduzz: ["tracker"],
  leadbit: ["subid"],
  drcash: ["sub1"],
  maxbounty: ["s1"],
  kiwify: ["src", "sck"],
};

/** Fallback quando o host não é reconhecido (CPA / MaxWeb em domínio próprio). */
export const UNKNOWN_OUTBOUND_KEYS = ["subid", "subid1", "subid2"] as const;

export function outboundClickKeys(platformId: string | null | undefined): readonly string[] {
  if (!platformId) return [];
  return AFFILIATE_OUTBOUND_CLICK_KEYS[platformId] || [];
}

function hostMatches(host: string, root: string): boolean {
  return host === root || host.endsWith(`.${root}`);
}

export function platformIdFromOfferHost(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (host === "digistore24.com" || host.endsWith(".digistore24.com") || host === "checkout-ds24.com" || host.endsWith(".checkout-ds24.com")) {
    return "digistore24";
  }
  if (hostMatches(host, "buygoods.com")) return "buygoods";
  if (host === "maxweb.com" || host.endsWith(".maxweb.com") || /^m\d+w\.com$/.test(host) || host.startsWith("mweb")) return "maxweb";
  if (hostMatches(host, "hotmart.com") || host === "pay.hotmart.com") return "hotmart";
  if (host.endsWith(".clickbank.net") || host === "clickbank.net" || host.endsWith(".clickbank.com") || host === "clickbank.com") {
    return "clickbank";
  }
  if (hostMatches(host, "warriorplus.com")) return "warriorplus";
  if (hostMatches(host, "jvzoo.com")) return "jvzoo";
  if (host.includes("smartadv") || host.endsWith(".smartadv.com")) return "smartadv";
  if (hostMatches(host, "monetizze.com.br") || hostMatches(host, "monetizze.com")) return "monetizze";
  if (hostMatches(host, "braip.com.br") || hostMatches(host, "braip.com")) return "braip";
  if (hostMatches(host, "eduzz.com") || hostMatches(host, "myeduzz.com")) return "eduzz";
  if (hostMatches(host, "adcombo.com")) return "adcombo";
  if (hostMatches(host, "everflow.io") || hostMatches(host, "eflow.team") || host.includes("everflowclient")) return "everflow";
  if (hostMatches(host, "leadbit.com")) return "leadbit";
  if (host === "dr.cash" || host.endsWith(".dr.cash") || hostMatches(host, "drcash.io")) return "drcash";
  if (hostMatches(host, "maxbounty.com")) return "maxbounty";
  if (hostMatches(host, "kiwify.com.br") || hostMatches(host, "kiwify.com")) return "kiwify";
  return null;
}
