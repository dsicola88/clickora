import type { PageDocument } from "@/page-builder/types";
import { normalizePageDocumentResponsive } from "@/page-builder/normalizeResponsive";

function asPageDocument(raw: unknown): PageDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.sections) || o.sections.length === 0) return null;
  return normalizePageDocumentResponsive(raw as PageDocument);
}

/** Extrai o documento do editor guardado em `content.pageDocument`. */
export function parsePresellBuilderPageDocument(content: unknown): PageDocument | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  return asPageDocument(c.pageDocument);
}

/** Rascunho do canvas ainda não publicado (sobrevive a corte de luz se chegou ao servidor). */
export function parsePresellEditorWorkingDocument(content: unknown): PageDocument | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  return asPageDocument(c.editorWorkingDocument);
}

/**
 * Fonte de verdade = BD (working → publicada). O localStorage do browser só entra
 * se a conta ainda não tiver documento (primeira visita / offline sem sync).
 */
export function pickPresellEditorDocument(args: {
  published: PageDocument | null;
  working: PageDocument | null;
  local: PageDocument | null;
}): PageDocument | null {
  if (args.working) return args.working;
  if (args.published) return args.published;
  return args.local;
}
