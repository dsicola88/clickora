/** Abaixo disto um operador móvel inteiro pode cair na lista. 0 = desligado. */
export const AUTO_BLACKLIST_MIN_CLICKS = 30;

export function effectiveAutoBlacklistThreshold(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const n = Math.floor(raw);
  if (n < AUTO_BLACKLIST_MIN_CLICKS) return AUTO_BLACKLIST_MIN_CLICKS;
  return Math.min(5000, n);
}

/**
 * Só estes motivos podem trocar a landing pública por página segura.
 * Bot/proxy/rate-limit/UA vazio NÃO devem alterar o HTML que o Ads vê —
 * isso é cloaking para Google Ads e mata conversões de media buyers
 * (clique conta no Ads, visitante vê texto sem oferta, zero hop /track/r).
 * Antifraude de bot/proxy continua no hop `/track/r/` e no pixel.
 */
export function isIntentionalPublicPageCloakReason(reason: string): boolean {
  return reason === "blacklist" || reason === "whitelist";
}

/**
 * Hop de oferta: proxy falso-positivo (VPN/carrier) com gclid/wbraid real
 * não deve bloquear a venda — o anúncio já foi cobrado.
 */
export function shouldBypassProxyBlockForPaidClick(args: {
  guardReason: string;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  msclkid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
}): boolean {
  if (args.guardReason !== "proxy_blocked") return false;
  const ids = [args.gclid, args.gbraid, args.wbraid, args.msclkid, args.fbclid, args.ttclid];
  return ids.some((v) => {
    if (v == null) return false;
    const s = String(v).trim();
    if (!s) return false;
    if (/^\{[\w.]+\}$/.test(s)) return false;
    if (/^\{\{[\w.]+\}\}$/.test(s)) return false;
    if (/^%7B[\w.]+%7D$/i.test(s)) return false;
    return true;
  });
}
