/**
 * Parâmetros de clique escritos no hoplink. Cada rede só recebe os seus.
 *
 * MaxWeb/BuyGoods: `subid` + `subid2` — a MaxWeb reescreve o lander com
 * `subid=<segmento do path>` (ex. 3986); {SUBID2} é o canal estável (Voluum).
 * Digistore24: `cid` + `sid1` — se outro tracker já ocupa `cid`, o UUID fica em `sid1`.
 * Hotmart: `src` + `sck` (backup nativo).
 * Domínio desconhecido: `subid` + `subid1` + `subid2` (redes CPA típicas).
 */
const OUTBOUND: Record<string, readonly string[]> = {
  digistore24: ["cid", "sid1"],
  buygoods: ["subid", "subid2"],
  maxweb: ["subid", "subid2"],
  smartadv: ["sub3"],
  hotmart: ["src", "sck"],
  clickbank: ["tid"],
  warriorplus: ["tid"],
  jvzoo: ["tid"],
};

/** Fallback quando o host não é reconhecido (CPA / MaxWeb em domínio próprio). */
export const UNKNOWN_OUTBOUND_KEYS = ["subid", "subid1", "subid2"] as const;

export function outboundClickKeys(platformId: string | null | undefined): readonly string[] {
  if (!platformId) return [];
  return OUTBOUND[platformId] || [];
}

export function platformIdFromOfferHost(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (host === "digistore24.com" || host.endsWith(".digistore24.com") || host === "checkout-ds24.com" || host.endsWith(".checkout-ds24.com")) {
    return "digistore24";
  }
  if (host === "buygoods.com" || host.endsWith(".buygoods.com")) return "buygoods";
  if (host === "maxweb.com" || host.endsWith(".maxweb.com") || /^m\d+w\.com$/.test(host) || host.startsWith("mweb")) return "maxweb";
  if (host === "hotmart.com" || host.endsWith(".hotmart.com") || host === "pay.hotmart.com") return "hotmart";
  if (host.endsWith(".clickbank.net") || host === "clickbank.net" || host.endsWith(".clickbank.com") || host === "clickbank.com") {
    return "clickbank";
  }
  if (host === "warriorplus.com" || host.endsWith(".warriorplus.com")) return "warriorplus";
  if (host === "jvzoo.com" || host.endsWith(".jvzoo.com")) return "jvzoo";
  if (host.includes("smartadv") || host.endsWith(".smartadv.com")) return "smartadv";
  return null;
}
