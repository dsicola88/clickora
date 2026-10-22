/**
 * Snippet Clickora para &lt;head&gt;: async (não bloqueia render) + data-presell-id quando conhecido.
 * Em páginas hospedadas (/p/…), PublicPresell injeta sempre com o UUID da página.
 */

const CLICKORA_SCRIPT_RE = /<script\b[^>]*clickora\.min\.js[^>]*>\s*<\/script>/gi;

export function stripClickoraEmbedScripts(html: string): string {
  return (html || "")
    .replace(CLICKORA_SCRIPT_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildClickoraEmbedScriptHtml(opts: {
  apiBase: string;
  userId?: string | null;
  /** UUID da presell — obrigatório fora de `/p/{uuid}` (ex. slug ou lander externo). */
  presellId?: string | null;
}): string {
  const base = (opts.apiBase || "").replace(/\/$/, "");
  if (!base) return "";
  const parts = [`src="${base}/track/v2/clickora.min.js"`, "async"];
  const uid = (opts.userId || "").trim();
  if (uid) parts.push(`data-id="${uid}"`);
  const pid = (opts.presellId || "").trim();
  if (pid) parts.push(`data-presell-id="${pid}"`);
  return `<script ${parts.join(" ")}></script>`;
}
