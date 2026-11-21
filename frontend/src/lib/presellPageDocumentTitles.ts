import type { PageDocument } from "@/page-builder/types";

const PLACEHOLDER_PAGE_TITLE =
  /^(p[aá]gina\s+sem\s+t[ií]tulo|p[aá]gina\s+sin\s+t[ií]tulo|untitled\s+page|untitled( document)?|nova\s+presell|new\s+presell|nova\s+p[aá]gina|new\s+page|presell)$/i;

export function looksLikePlaceholderPageTitle(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return PLACEHOLDER_PAGE_TITLE.test(t);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** HTML do espelho importado — `importMirrorSrcDoc` ou folds HTML no `pageDocument`. */
export function collectPresellMirrorHtml(
  content: Record<string, unknown>,
  doc: PageDocument | null,
): string {
  const direct =
    typeof content.importMirrorSrcDoc === "string"
      ? content.importMirrorSrcDoc
      : typeof content.import_mirror_src_doc === "string"
        ? content.import_mirror_src_doc
        : "";
  if (direct.trim().length >= 20) return direct;
  if (!doc?.sections?.length) return "";
  const chunks: string[] = [];
  for (const section of doc.sections) {
    for (const col of section.columns ?? []) {
      for (const w of col.widgets ?? []) {
        if (w.type !== "html") continue;
        const code = asString((w.content as { code?: unknown })?.code);
        if (code.length >= 20) chunks.push(code);
      }
    }
  }
  return chunks.join("\n");
}

/**
 * Corrige `doc.name` / `seo.title` guardados como default do builder («Página sem título»)
 * quando a importação já tem nome de produto ou título da sales page.
 */
/** Primeiro H1/H2 do canvas manual — tab do browser quando o espelho não traz `<title>`. */
export function firstProminentHeadingFromPageDocument(doc: PageDocument | null | undefined): string {
  if (!doc?.sections?.length) return "";
  for (const section of doc.sections) {
    for (const col of section.columns ?? []) {
      for (const w of col.widgets ?? []) {
        if (w.type === "heading") {
          const text = asString((w.content as { text?: unknown })?.text);
          if (text && !looksLikePlaceholderPageTitle(text)) return text;
        }
        if (w.type === "html") {
          const code = asString((w.content as { code?: unknown })?.code);
          const m =
            code.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || code.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
          if (m?.[1]) {
            const t = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
            if (t && !looksLikePlaceholderPageTitle(t)) return t;
          }
        }
      }
    }
  }
  return "";
}

export function ensurePresellPageDocumentTitles(
  doc: PageDocument,
  content: Record<string, unknown>,
  pageTitle?: string,
): PageDocument {
  const preferred = [
    asString(content.productName),
    asString(content.product_name),
    asString(content.sourcePageTitle),
    asString(content.source_page_title),
    asString(content.title),
    asString(pageTitle),
  ].find((s) => s && !looksLikePlaceholderPageTitle(s));
  if (!preferred) return doc;

  const nameBad = looksLikePlaceholderPageTitle(doc.name);
  const seoTitle = asString(doc.seo?.title);
  const seoBad = !seoTitle || looksLikePlaceholderPageTitle(seoTitle);
  if (!nameBad && !seoBad) return doc;

  return {
    ...doc,
    name: nameBad ? preferred : doc.name,
    seo: {
      ...doc.seo,
      ...(seoBad ? { title: preferred } : {}),
    },
  };
}