/**
 * Texto seguro para títulos e legendas quando o backend ou o armazenamento
 * contêm restos de HTML (&lt;strong&gt;, tags, entidades).
 */
export function plainTextFromMaybeHtml(raw: string | undefined | null): string {
  if (raw == null) return "";
  let s = String(raw);
  try {
    s = s.replace(/&nbsp;/gi, " ");
    s = s
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  } catch {
    /* ignore */
  }
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\*{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
