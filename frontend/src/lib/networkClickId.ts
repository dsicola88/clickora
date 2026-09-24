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
