/** Valida URL de submissão de formulário na landing (https ou http local). */
export function isAllowedFormAction(url: string): boolean {
  const u = String(url ?? "").trim();
  if (!u) return false;
  try {
    const x = new URL(u);
    if (x.protocol === "https:") return true;
    if (x.protocol === "http:" && (x.hostname === "localhost" || x.hostname === "127.0.0.1")) return true;
    return false;
  } catch {
    return false;
  }
}
