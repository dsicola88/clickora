import { createEmptyPage } from "./factory";
import type { PageDocument } from "./types";

export const EXPORTED_HTML_SCRIPT_ID = "clickora-builder-document";

export function isValidPageDocument(raw: unknown): raw is PageDocument {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.sections);
}

/** Garante campos mínimos após importação. */
export function normalizeImportedDocument(raw: PageDocument): PageDocument {
  const nm =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : "Página importada";
  const base = createEmptyPage(nm);
  return {
    ...base,
    ...raw,
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : base.id,
    name: nm,
    sections: Array.isArray(raw.sections) ? raw.sections : [],
    settings: raw.settings && typeof raw.settings === "object"
      ? { maxContentWidth: 1140, background: "#ffffff", ...raw.settings }
      : base.settings,
    seo: raw.seo,
    tracking: raw.tracking,
    updatedAt: Date.now(),
  };
}

/** Interpreta ficheiro JSON exportado do builder. */
export function parsePageDocumentFromJson(text: string): PageDocument | null {
  try {
    const raw = JSON.parse(text) as unknown;
    if (!isValidPageDocument(raw)) return null;
    return normalizeImportedDocument(raw);
  } catch {
    return null;
  }
}

/**
 * Extrai o documento embutido no HTML exportado pelo Clickora (script JSON seguro).
 * Compatível com exports antigos sem payload (devolve null).
 */
export function extractPageDocumentFromExportedHtml(html: string): PageDocument | null {
  const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
  if (!parser) return null;
  const doc = parser.parseFromString(html, "text/html");
  const script = doc.getElementById(EXPORTED_HTML_SCRIPT_ID);
  if (script?.textContent) {
    const safe = script.textContent.trim();
    if (!safe) return null;
    try {
      const raw = JSON.parse(safe) as unknown;
      if (!isValidPageDocument(raw)) return null;
      return normalizeImportedDocument(raw);
    } catch {
      return null;
    }
  }
  return null;
}
