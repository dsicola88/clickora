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
 * Tooltip «Tipo» — linguagem simples para o afiliado.
 */
export function explainTrafficTypeLabel(
  args: Parameters<typeof resolveTrafficType>[0] & {
    visitorKind?: "real" | "bot" | "datacenter" | null;
  },
): string {
  const kind = resolveTrafficType(args);
  if (kind === "paid") {
    return "Clique veio do anúncio com ID completo — podes ligar a venda ao Google/Meta/TikTok.";
  }
  if (kind === "organic") {
    return "Sem sinais de anúncio pago (nem campanha nem ID de clique).";
  }
  const macros = listUnreplacedClickIdMacros(args);
  if (macros.length > 0) {
    return "O link ainda tem {…} por preencher. Não abras o URL copiado no browser — clica no anúncio real no Google Ads.";
  }
  if (args.visitorKind === "datacenter") {
    return "Parece robot ou servidor do Google a visitar a página — não é um comprador. Ignora estas linhas ao analisar vendas.";
  }
  return "Campanha detectada, mas sem ID do clique. Confirma em Google Ads → Configurações da conta → Codificação automática = Sim, e cola a URL gerada pela Clickora (não abras o link de teste no browser).";
}
