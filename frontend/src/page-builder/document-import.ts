import { createEmptyPage } from "./factory";
import type { PageDocument } from "./types";

export const EXPORTED_HTML_SCRIPT_ID = "clickora-builder-document";

export type ParsePageDocumentFailureReason =
  | "not_json"
  | "wrong_shape"
  | "empty";

export type ParsePageDocumentResult =
  | { ok: true; doc: PageDocument }
  | { ok: false; reason: ParsePageDocumentFailureReason };

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
    settings:
      raw.settings && typeof raw.settings === "object"
        ? { maxContentWidth: 1140, background: "#ffffff", ...raw.settings }
        : base.settings,
    popups: Array.isArray(raw.popups) ? raw.popups : [],
    seo: raw.seo,
    tracking: raw.tracking,
    updatedAt: Date.now(),
  };
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "").trim();
}

/** Candidatos a PageDocument dentro de exports Clickora / API. */
function collectDocumentCandidates(root: unknown): unknown[] {
  if (!root || typeof root !== "object") return [];
  const o = root as Record<string, unknown>;
  const out: unknown[] = [root];

  const pushObj = (v: unknown) => {
    if (v && typeof v === "object") out.push(v);
  };

  pushObj(o.pageDocument);
  pushObj(o.document);
  pushObj(o.data);
  pushObj(o.payload);

  const content = o.content;
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    pushObj(c.pageDocument);
    pushObj(c.editorWorkingDocument);
    pushObj(c.document);
  }

  const presell = o.presell;
  if (presell && typeof presell === "object") {
    const p = presell as Record<string, unknown>;
    pushObj(p.content);
    const pc = p.content;
    if (pc && typeof pc === "object") {
      const c = pc as Record<string, unknown>;
      pushObj(c.pageDocument);
      pushObj(c.editorWorkingDocument);
    }
  }

  return out;
}

function looksLikeElementor(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    Array.isArray(o.content) ||
    o.version != null && (o.type === "page" || o.type === "section") && !Array.isArray(o.sections)
  );
}

/**
 * Interpreta ficheiro JSON do builder, ou export da API/presell com
 * `content.pageDocument` / `editorWorkingDocument` aninhado.
 */
export function parsePageDocumentFromJson(text: string): PageDocument | null {
  const result = parsePageDocumentFromJsonDetailed(text);
  return result.ok ? result.doc : null;
}

export function parsePageDocumentFromJsonDetailed(text: string): ParsePageDocumentResult {
  const cleaned = stripBom(text);
  if (!cleaned) return { ok: false, reason: "empty" };

  let root: unknown;
  try {
    root = JSON.parse(cleaned) as unknown;
  } catch {
    return { ok: false, reason: "not_json" };
  }

  for (const candidate of collectDocumentCandidates(root)) {
    if (isValidPageDocument(candidate)) {
      return { ok: true, doc: normalizeImportedDocument(candidate) };
    }
  }

  if (looksLikeElementor(root)) {
    return { ok: false, reason: "wrong_shape" };
  }

  return { ok: false, reason: "wrong_shape" };
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
  // Fallback: HTML que é só um JSON (raro) ou script sem id.
  const detailed = parsePageDocumentFromJsonDetailed(html);
  return detailed.ok ? detailed.doc : null;
}
