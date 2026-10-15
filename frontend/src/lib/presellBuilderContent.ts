import type { PageDocument } from "@/page-builder/types";

function asPageDocument(raw: unknown): PageDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.sections) || o.sections.length === 0) return null;
  return raw as PageDocument;
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

function docTime(doc: PageDocument | null | undefined): number {
  if (!doc) return 0;
  const n = Number(doc.updatedAt);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Preferência: rascunho local mais recente, depois o working no servidor, depois a página publicada.
 * Assim Editar não desfaz o canvas e um crash recupera o que estava a ser editado.
 */
export function pickPresellEditorDocument(args: {
  published: PageDocument | null;
  working: PageDocument | null;
  local: PageDocument | null;
}): PageDocument | null {
  const ranked = [
    { doc: args.local, tie: 2 },
    { doc: args.working, tie: 1 },
    { doc: args.published, tie: 0 },
  ].filter((row): row is { doc: PageDocument; tie: number } => Boolean(row.doc));
  if (!ranked.length) return null;
  return ranked.reduce((best, next) => {
    const nextT = docTime(next.doc);
    const bestT = docTime(best.doc);
    if (nextT > bestT) return next;
    if (nextT === bestT && next.tie > best.tie) return next;
    return best;
  }).doc;
}
