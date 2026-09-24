/**
 * Macros ValueTrack / UTM que a rede deve substituir no clique.
 * Se chegarem literais (`{keyword}`), o clique NÃO veio de um anúncio real
 * (teste manual) ou o URL foi gerado com chaves encodeadas (`%7Bkeyword%7D`).
 */

const MACRO_RE = /^\{[a-zA-Z0-9_.]+\}$/;
const META_MACRO_RE = /^\{\{[a-zA-Z0-9_.]+\}\}$/;
const ENCODED_MACRO_RE = /^%7B[a-zA-Z0-9_.]+%7D$/i;
const ENCODED_META_MACRO_RE = /^%7B%7B[a-zA-Z0-9_.]+%7D%7D$/i;

export function isUnreplacedAdMacro(raw: string | null | undefined): boolean {
  const t = (raw || "").trim();
  if (!t) return false;
  if (MACRO_RE.test(t) || META_MACRO_RE.test(t)) return true;
  if (ENCODED_MACRO_RE.test(t) || ENCODED_META_MACRO_RE.test(t)) return true;
  try {
    const decoded = decodeURIComponent(t);
    if (decoded !== t && (MACRO_RE.test(decoded) || META_MACRO_RE.test(decoded))) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Dimensão de relatório: macros não substituídas → null (agregar em «sem keyword / sem ad group»).
 */
export function normalizeUtmDimension(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  if (isUnreplacedAdMacro(t)) return null;
  return t;
}
