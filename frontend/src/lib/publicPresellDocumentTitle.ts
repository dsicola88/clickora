import type { Presell } from "@/types/api";

/** Alinhar com `frontend/index.html` — valor ao sair da página pública. */
export const DEFAULT_BROWSER_TAB_TITLE = "dclickora - Presell Pages & Tracking para Afiliados";

/**
 * Título do separador do browser na presell pública.
 * - Domínio próprio: «título da oferta · hostname» (confiança, sem marca da plataforma).
 * - dclickora.com: «título da oferta · dclickora».
 * - localhost / preview Vercel: só o título da oferta.
 */
export function resolvePublicPresellDocumentTitle(page: Presell): string {
  const content = (page.content || {}) as Record<string, unknown>;
  const headline = String(content.title || page.title || "").trim() || "Página";
  if (typeof window === "undefined") return headline;

  const host = window.location.hostname;
  const isMainApp = host === "dclickora.com" || host === "www.dclickora.com";
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isVercelPreview = host.endsWith(".vercel.app");

  if (isLocal || isVercelPreview) {
    return headline;
  }
  if (isMainApp) {
    return `${headline} · dclickora`;
  }
  return `${headline} · ${host}`;
}
