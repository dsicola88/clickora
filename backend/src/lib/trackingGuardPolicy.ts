/** Abaixo disto um operador móvel inteiro pode cair na lista. 0 = desligado. */
export const AUTO_BLACKLIST_MIN_CLICKS = 30;

export function effectiveAutoBlacklistThreshold(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const n = Math.floor(raw);
  if (n < AUTO_BLACKLIST_MIN_CLICKS) return AUTO_BLACKLIST_MIN_CLICKS;
  return Math.min(5000, n);
}

/**
 * Motivos que trocam a landing pública por página segura.
 *
 * Por defeito / compliance Ads: **nenhum** — blacklist, whitelist, bot, proxy,
 * rate-limit e UA vazio NÃO alteram o HTML da Final URL.
 * Antifraude continua no hop `/track/r/` e no pixel (403 / sem clique).
 *
 * Cloak geo (`enterpriseCloak` + `cloakGeoDeny`) é opt-in por presell
 * (`shouldServeCloakSafePage`); AdsBot / Googlebot bypassam.
 */
export function isIntentionalPublicPageCloakReason(_reason: string): boolean {
  return false;
}

function isRealPaidClickSignal(value: string | null | undefined): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  if (/^\{[\w.]+\}$/.test(s)) return false;
  if (/^\{\{[\w.]+\}\}$/.test(s)) return false;
  if (/^%7B[\w.]+%7D$/i.test(s)) return false;
  return true;
}

/**
 * Hop de oferta: proxy falso-positivo (VPN/carrier) com gclid/wbraid real
 * (ou gad_source do Google Ads) não deve bloquear a venda — o anúncio já foi cobrado.
 */
export function shouldBypassProxyBlockForPaidClick(args: {
  guardReason: string;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  msclkid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  /** Google Ads costuma enviar `gad_source=1` mesmo quando só há wbraid/gbraid. */
  gad_source?: string | null;
}): boolean {
  if (args.guardReason !== "proxy_blocked") return false;
  const ids = [args.gclid, args.gbraid, args.wbraid, args.msclkid, args.fbclid, args.ttclid];
  if (ids.some((v) => isRealPaidClickSignal(v))) return true;
  const gad = String(args.gad_source ?? "").trim();
  return Boolean(gad) && gad !== "0" && !/^\{/.test(gad);
}
