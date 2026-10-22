/**
 * Remove scripts existentes que carregam clickora.min.js e junta o script atual da conta
 * no início do código do head (sem duplicar o mesmo snippet).
 */
import { stripClickoraEmbedScripts } from "./clickoraEmbedScript";

export function mergeClickoraTrackingIntoHeader(headerCode: string, clickoraScript: string): string {
  const s = (clickoraScript || "").trim();
  if (!s) return (headerCode || "").trim();

  let h = stripClickoraEmbedScripts(headerCode || "");

  if (h.includes(s)) return h;
  return h ? `${s}\n\n${h}` : s;
}
