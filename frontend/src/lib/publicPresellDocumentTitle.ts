import type { Presell } from "@/types/api";

/** Alinhar com `frontend/index.html` — valor ao sair da página pública. */
export const DEFAULT_BROWSER_TAB_TITLE = "dclickora - Presell Pages & Tracking para Afiliados";

const MAX_LABEL = 100;

function clampLabel(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t.length > MAX_LABEL ? `${t.slice(0, MAX_LABEL - 1)}…` : t;
}

/**
 * Nome curto do produto / página para o separador — **não** usa o headline longo (`content.title`).
 * Ordem: nome vindo da importação → «Nome da página» no painel (`page.title`) → último recurso «Página».
 */
export function getPresellProductLabel(page: Presell): string {
  const c = (page.content || {}) as Record<string, unknown>;
  const fromImport = clampLabel(String(c.productName ?? c.product_name ?? ""));
  if (fromImport) return fromImport;
  const pageName = clampLabel(String(page.title ?? ""));
  if (pageName) return pageName;
  return "Página";
}

/**
 * Título do separador: `{hostname} | {nome do produto}` (sem headline de marketing).
 */
export function resolvePublicPresellDocumentTitle(page: Presell): string {
  const product = getPresellProductLabel(page);
  if (typeof window === "undefined") {
    return product;
  }
  const host = window.location.hostname;
  return `${host} | ${product}`;
}

/** Para export HTML: mesmo padrão usando o URL público da presell. */
export function buildExportDocumentTitle(page: Presell, publicPageUrl: string): string {
  const product = getPresellProductLabel(page);
  try {
    const h = new URL(publicPageUrl).hostname;
    if (h) return `${h} | ${product}`;
  } catch {
    /* ignore */
  }
  return product;
}
