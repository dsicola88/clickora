/**
 * IDs de clique de rede reais (não macros por substituir).
 * Ex.: `gclid={gclid}` na URL copiada do anúncio ≠ tráfego pago real.
 */
export function isRealNetworkClickId(value: string | null | undefined): boolean {
  if (value == null) return false;
  const v = String(value).trim();
  if (!v) return false;
  if (/^\{[\w.]+\}$/.test(v)) return false;
  if (/^\{\{[\w.]+\}\}$/.test(v)) return false;
  if (/^%7B[\w.]+%7D$/i.test(v)) return false;
  if (/^\$\{[\w.]+\}$/.test(v)) return false;
  if (/^\[\[\w+\]\]$/.test(v)) return false;
  return true;
}

export function hasPaidNetworkClickId(meta: {
  gclid?: string | null;
  msclkid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
}): boolean {
  return (
    isRealNetworkClickId(meta.gclid) ||
    isRealNetworkClickId(meta.msclkid) ||
    isRealNetworkClickId(meta.fbclid) ||
    isRealNetworkClickId(meta.ttclid)
  );
}

const PAID_SOURCE_RE =
  /google|gclid|bing|microsoft|yahoo|facebook|meta|fbclid|tiktok|ttclid|pinterest|taboola|outbrain|kwai|twitter|x\.com|cpc|ppc|paid|ads/i;
const PAID_MEDIUM_RE = /^(cpc|ppc|paid|paidsearch|paid_social|cpm|cpa|display|retargeting)$/i;

export function hasPaidAdSourceSignals(args: {
  source?: string | null;
  medium?: string | null;
  utm_source?: string | null;
  gclid?: string | null;
  msclkid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
}): boolean {
  if (hasPaidNetworkClickId(args)) return true;
  const src = `${args.source || ""} ${args.utm_source || ""}`.trim();
  const med = (args.medium || "").trim();
  if (med && PAID_MEDIUM_RE.test(med)) return true;
  if (src && PAID_SOURCE_RE.test(src)) return true;
  const maybeMacro =
    (args.gclid && !isRealNetworkClickId(args.gclid) && String(args.gclid).trim().length > 0) ||
    (args.msclkid && !isRealNetworkClickId(args.msclkid) && String(args.msclkid).trim().length > 0) ||
    (args.fbclid && !isRealNetworkClickId(args.fbclid) && String(args.fbclid).trim().length > 0) ||
    (args.ttclid && !isRealNetworkClickId(args.ttclid) && String(args.ttclid).trim().length > 0);
  return Boolean(maybeMacro);
}

export type TrafficTypeLabel = "paid" | "paid_untracked" | "organic";

export function resolveTrafficType(args: {
  source?: string | null;
  medium?: string | null;
  utm_source?: string | null;
  gclid?: string | null;
  msclkid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
}): TrafficTypeLabel {
  if (hasPaidNetworkClickId(args)) return "paid";
  if (hasPaidAdSourceSignals(args)) return "paid_untracked";
  return "organic";
}
