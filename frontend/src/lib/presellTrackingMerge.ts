/**
 * Remove scripts existentes que carregam clickora.min.js e junta o script atual da conta
 * no início do código do head (sem duplicar o mesmo snippet).
 */
const CLICKORA_HEAD_SCRIPT_RE = /<script\b[^>]*clickora\.min\.js[^>]*>\s*<\/script>/gi;

export function mergeClickoraTrackingIntoHeader(headerCode: string, clickoraScript: string): string {
  const s = (clickoraScript || "").trim();
  if (!s) return (headerCode || "").trim();

  let h = (headerCode || "").trim();
  h = h.replace(CLICKORA_HEAD_SCRIPT_RE, "").replace(/\n{3,}/g, "\n\n").trim();

  if (h.includes(s)) return h;
  return h ? `${s}\n\n${h}` : s;
}
