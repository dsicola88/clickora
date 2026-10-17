import { sanitizeMirrorSrcDocFromEditor } from "./presellMirrorSnapshot";

/** Sanitiza `importMirrorSrcDoc` antes de persistir (edição visual ou textarea). */
export function sanitizeMirrorInContentRecord(content: Record<string, unknown>): Record<string, unknown> {
  const raw = content.importMirrorSrcDoc;
  if (typeof raw !== "string") return content;
  const mirror = raw.trim();
  if (mirror.length <= 200) return content;

  const aff = String(content.affiliateLink ?? content.affiliate_link ?? "").trim();
  const base = String(content.sourceUrl ?? content.source_url ?? aff).trim();
  if (!aff && !base) return content;

  const cleaned = sanitizeMirrorSrcDocFromEditor(mirror, base || aff, aff || base);
  if (!cleaned) return content;
  return { ...content, importMirrorSrcDoc: cleaned };
}
