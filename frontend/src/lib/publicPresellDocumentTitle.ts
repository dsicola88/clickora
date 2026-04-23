import type { Presell } from "@/types/api";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";

/** Alinhar com `frontend/index.html` — valor ao sair da página pública. */
export const DEFAULT_BROWSER_TAB_TITLE =
  "dclickora — Presell pages, rastreamento de conversões e ferramenta para afiliados";

const MAX_SEO_TITLE = 110;

function clampSeoTitle(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t.length > MAX_SEO_TITLE ? `${t.slice(0, MAX_SEO_TITLE - 1)}…` : t;
}

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
 * Título principal para `<title>`, Open Graph e JSON-LD.
 * Prioridade: **Nome da página** no painel (`page.title`) — o que o utilizador vê no campo «Nome da página» —
 * depois SEO interno do builder, nome do documento, headline/H1, rótulos de produto.
 */
export function getPresellSeoPrimaryTitle(page: Presell): string {
  const pageName = String(page.title ?? "").trim();
  if (pageName) return clampSeoTitle(pageName);

  const c = (page.content || {}) as Record<string, unknown>;
  if (page.type === "builder") {
    const doc = parsePresellBuilderPageDocument(page.content);
    if (doc) {
      const st = String(doc.seo?.title ?? "").trim();
      if (st) return clampSeoTitle(st);
      const nm = String(doc.name ?? "").trim();
      if (nm) return clampSeoTitle(nm);
    }
  }
  const headline = String(c.title ?? "").trim();
  if (headline) return clampSeoTitle(headline);
  return getPresellProductLabel(page);
}

/**
 * Título do separador: `{título SEO} | {hostname}` — palavra-chave primeiro.
 */
export function resolvePublicPresellDocumentTitle(page: Presell): string {
  const primary = getPresellSeoPrimaryTitle(page);
  if (typeof window === "undefined") {
    return primary;
  }
  const host = window.location.hostname;
  return `${primary} | ${host}`;
}

/** Para export HTML: mesmo padrão usando o URL público da presell. */
export function buildExportDocumentTitle(page: Presell, publicPageUrl: string): string {
  const primary = getPresellSeoPrimaryTitle(page);
  try {
    const h = new URL(publicPageUrl).hostname;
    if (h) return `${primary} | ${h}`;
  } catch {
    /* ignore */
  }
  return primary;
}
