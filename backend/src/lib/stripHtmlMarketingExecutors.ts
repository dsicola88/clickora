/**
 * Remove executores de marketing de HTML (scripts / handlers / javascript:).
 * Partilhado com a SPA (`frontend/src/lib/stripHtmlMarketingExecutors.ts`) — manter lógica alinhada.
 */

export function stripHtmlMarketingExecutors(html: string): string {
  if (!html) return html;
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "void:");
}

export function htmlLooksLikeItHadScripts(html: string): boolean {
  return /<script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html) || /javascript:/i.test(html);
}