const VIEWPORT_META =
  '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';

/**
 * Meta viewport partida (ex. parser a truncar `content=`) — layout mobile errado no espelho.
 */
export function normalizeBrokenViewportMeta(html: string): string {
  let out = html.replace(/<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/gi, (tag) => {
    if (/\bcontent\s*=/i.test(tag)) return tag;
    return VIEWPORT_META;
  });
  const seen = new Set<string>();
  out = out.replace(/<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*>/gi, (tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return "";
    seen.add(key);
    return tag;
  });
  return out;
}

/**
 * Fragmento do widget HTML (head inline + body) → `srcDoc` de iframe (CSS da origem intacto).
 */
export function wrapMirrorFoldAsFullSrcDoc(fragment: string): string {
  const raw = fragment.trim();
  if (!raw) return "";
  if (/<!DOCTYPE\s+html/i.test(raw) || /<html[\s>]/i.test(raw)) {
    return normalizeBrokenViewportMeta(raw);
  }
  const headBits: string[] = [];
  let rest = raw;
  const headRe = /^(\s*(?:<base\b[^>]*>|<link\b[^>]*>|<style\b[\s\S]*?<\/style>|<meta\b[^>]*>))+/i;
  const m = raw.match(headRe);
  if (m) {
    headBits.push(m[0]);
    rest = raw.slice(m[0].length);
  }
  const doc = `<!DOCTYPE html><html><head>${VIEWPORT_META}${headBits.join("")}</head><body>${rest}</body></html>`;
  return normalizeBrokenViewportMeta(doc);
}