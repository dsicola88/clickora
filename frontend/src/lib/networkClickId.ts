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
  gbraid?: string | null;
  wbraid?: string | null;
}): boolean {
  return (
    isRealNetworkClickId(meta.gclid) ||
    isRealNetworkClickId(meta.msclkid) ||
    isRealNetworkClickId(meta.fbclid) ||
    isRealNetworkClickId(meta.ttclid) ||
    isRealNetworkClickId(meta.gbraid) ||
    isRealNetworkClickId(meta.wbraid)
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
  gbraid?: string | null;
  wbraid?: string | null;
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
    (args.ttclid && !isRealNetworkClickId(args.ttclid) && String(args.ttclid).trim().length > 0) ||
    (args.gbraid && !isRealNetworkClickId(args.gbraid) && String(args.gbraid).trim().length > 0) ||
    (args.wbraid && !isRealNetworkClickId(args.wbraid) && String(args.wbraid).trim().length > 0);
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
  gbraid?: string | null;
  wbraid?: string | null;
}): TrafficTypeLabel {
  if (hasPaidNetworkClickId(args)) return "paid";
  if (hasPaidAdSourceSignals(args)) return "paid_untracked";
  return "organic";
}

const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "ttclid"] as const;

/** Macros literais presentes (ex. `{gclid}`) — link de template, não clique real. */
export function listUnreplacedClickIdMacros(args: {
  gclid?: string | null;
  msclkid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
}): string[] {
  const out: string[] = [];
  for (const k of CLICK_ID_KEYS) {
    const raw = args[k];
    if (raw == null) continue;
    const v = String(raw).trim();
    if (!v) continue;
    if (!isRealNetworkClickId(v)) out.push(k);
  }
  return out;
}

/**
 * Texto do tooltip «Tipo» — accionável, sem inventar causa.
 * `visitorKind` opcional: cloud Google + UTM ≠ comprador.
 */
export function explainTrafficTypeLabel(
  args: Parameters<typeof resolveTrafficType>[0] & {
    visitorKind?: "real" | "bot" | "datacenter" | null;
  },
): string {
  const kind = resolveTrafficType(args);
  if (kind === "paid") {
    return "ID de clique real (gclid/gbraid/wbraid/msclkid/fbclid/ttclid). Pode atribuir conversão às Ads.";
  }
  if (kind === "organic") {
    return "Sem sinais de anúncio (UTM/cpc) nem ID de clique.";
  }
  const macros = listUnreplacedClickIdMacros(args);
  if (macros.length > 0) {
    return `Macro não substituída (${macros.join(", ")}). Abre o anúncio real no Google Ads — não copies o URL do Construtor com {gclid}. Auto-tagging da conta deve estar ligado.`;
  }
  if (args.visitorKind === "datacenter") {
    return "UTM/cpc sem ID de clique + IP cloud. Tipicamente AdsBot, preview ou servidor — não é comprador. Confirma auto-tagging e que a Final URL preserva ?gclid=…";
  }
  return "UTM/cpc sem gclid/gbraid/wbraid. No Google Ads: Definições da conta → auto-tagging ON; Final URL (ou suffix) com UTMs; testa a landing com ?gclid=TesTER-123 e confirma que o parâmetro fica na barra.";
}
