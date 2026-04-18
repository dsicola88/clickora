import type { PageDocument } from "@/page-builder/types";

/** Extrai o documento do editor guardado em `content.pageDocument`. */
export function parsePresellBuilderPageDocument(content: unknown): PageDocument | null {
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, unknown>;
  const pd = c.pageDocument;
  if (!pd || typeof pd !== "object") return null;
  const o = pd as Record<string, unknown>;
  if (!Array.isArray(o.sections)) return null;
  return pd as PageDocument;
}
