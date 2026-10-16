/**
 * O gerador (URL → pageDocument) não pode colar um produto de catálogo
 * (Visivra, Neotonics, …) quando a origem não o menciona.
 */

export const STOCK_CATALOG_PRODUCT_RE =
  /\b(visivra|tryvisivra|neotonics|nitric\s*boost|yusleep|stopwatt)\b|why choose visivra|natural support for sharp and clear vision/i;

export function generatedCopyLeaksStockProduct(generated: string, sourceBlob: string): boolean {
  const gen = generated.trim();
  const src = sourceBlob.trim();
  if (!STOCK_CATALOG_PRODUCT_RE.test(gen)) return false;
  const hits = gen.match(new RegExp(STOCK_CATALOG_PRODUCT_RE.source, "gi")) ?? [];
  return hits.some((h) => !src.toLowerCase().includes(h.toLowerCase()));
}

export function documentTextBlob(doc: { sections?: unknown }): string {
  try {
    return JSON.stringify(doc);
  } catch {
    return "";
  }
}
