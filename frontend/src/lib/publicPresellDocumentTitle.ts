import type { Presell } from "@/types/api";
import { parsePresellBuilderPageDocument } from "@/lib/presellBuilderContent";
import { plainTextFromMaybeHtml } from "@/lib/plainTextFromMaybeHtml";
import { resolvePresellGenerationNiche } from "@/lib/presellGenerationNiche";
import {
  collectPresellMirrorHtml,
  looksLikePlaceholderPageTitle,
} from "@/lib/presellPageDocumentTitles";

/** Alinhar com `frontend/index.html` — valor ao sair da página pública. */
export const DEFAULT_BROWSER_TAB_TITLE =
  "dclickora — Presell pages, rastreamento de conversões e ferramenta para afiliados";

const MAX_SEO_TITLE = 120;

export function looksLikeAppBrandTitle(s: string): boolean {
  return /dclickora|clickora|presell pages.*rastreamento|ferramenta para afiliados/i.test(s);
}

/**
 * Título de sales page agressiva (PT/EN) — na black EN não deve virar &lt;title&gt;
 * (ex.: «Adquira seu Melara Max hoje mesmo»).
 */
export function looksLikeAggressiveSalesSourceTitle(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /\b(adquira|compre agora|comprar agora|buy now|order now|shop now|get yours|claim your|hoje mesmo|encomendar agora|add to cart)\b/i.test(
    t,
  );
}

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
  const fromImport = clampLabel(plainTextFromMaybeHtml(String(c.productName ?? c.product_name ?? "")));
  if (fromImport) return fromImport;
  const pageName = clampLabel(String(page.title ?? ""));
  if (pageName && !looksLikePlaceholderPageTitle(pageName)) return pageName;
  return "Página";
}

function firstUsableSeoTitle(candidates: string[]): string {
  for (const raw of candidates) {
    const t = clampSeoTitle(plainTextFromMaybeHtml(raw));
    if (!t || looksLikeAppBrandTitle(t) || looksLikePlaceholderPageTitle(t)) continue;
    return t;
  }
  return "";
}

function titleFromImportedHtml(html: string): string {
  const t = html.trim();
  if (t.length < 20) return "";
  const og = t.match(
    /<meta[^>]+(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  const ogRev = t.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:title["']/i,
  );
  const titleTag = t.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return firstUsableSeoTitle([og?.[1] || "", ogRev?.[1] || "", titleTag?.[1] || ""]);
}

/**
 * Título principal para `<title>`, Open Graph e JSON-LD — nome do produto / título oficial da origem,
 * não o nome interno da campanha nem o da app.
 */
export function getPresellSeoPrimaryTitle(page: Presell): string {
  const c = (page.content || {}) as Record<string, unknown>;
  const doc = page.type === "builder" || c.pageDocument ? parsePresellBuilderPageDocument(page.content) : null;
  const mirror = collectPresellMirrorHtml(c, doc);
  const sourceTitle = String(c.sourcePageTitle ?? c.source_page_title ?? "").trim();
  const niche = resolvePresellGenerationNiche(c);
  const sourceOk =
    sourceTitle &&
    !looksLikeAppBrandTitle(sourceTitle) &&
    !(niche === "black" && looksLikeAggressiveSalesSourceTitle(sourceTitle));

  // Black: portal informativo — produto primeiro; evita título de sales page PT em landers EN.
  const candidates =
    niche === "black"
      ? [
          String(doc?.seo?.title ?? ""),
          String(c.productName ?? c.product_name ?? ""),
          String(c.title ?? ""),
          sourceOk ? sourceTitle : "",
          String(doc?.name ?? ""),
          String(page.title ?? ""),
        ]
      : [
          String(doc?.seo?.title ?? ""),
          sourceOk ? sourceTitle : "",
          titleFromImportedHtml(mirror),
          String(c.productName ?? c.product_name ?? ""),
          String(c.title ?? ""),
          String(doc?.name ?? ""),
          String(page.title ?? ""),
        ];

  const picked = firstUsableSeoTitle(candidates);
  return picked || getPresellProductLabel(page);
}

/**
 * Título do separador e do Google: só o nome do produto / título oficial.
 * O domínio aparece à parte (como em visivra.net) — não sufixar `| dclickora.com`.
 */
export function resolvePublicPresellDocumentTitle(page: Presell): string {
  return getPresellSeoPrimaryTitle(page);
}

/** Para export HTML: o mesmo título da página pública (sem hostname). */
export function buildExportDocumentTitle(page: Presell, _publicPageUrl: string): string {
  void _publicPageUrl;
  return getPresellSeoPrimaryTitle(page);
}
