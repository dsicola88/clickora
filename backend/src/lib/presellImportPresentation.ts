export type PresellImportPresentation = "mirror" | "essentials";

export function isEssentialsImportPresentation(content: unknown): boolean {
  const c = content && typeof content === "object" && !Array.isArray(content) ? (content as Record<string, unknown>) : {};
  const raw = c.importPresentation ?? c.import_presentation;
  return typeof raw === "string" && raw.trim().toLowerCase() === "essentials";
}