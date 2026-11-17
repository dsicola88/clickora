/**
 * Remove executores de marketing de HTML (scripts / handlers / javascript:).
 * Defesa em profundidade para espelho em páginas cookies antes do Aceitar.
 * O iframe público também corre sem allow-scripts no sandbox.
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
