/**
 * Normaliza erros (RPC, Rede, Error) para mensagem segura a mostrar ao utilizador.
 */
export function getRequestErrorMessage(
  error: unknown,
  fallback = "Ocorreu um erro. Tente novamente.",
): string {
  if (error instanceof Error) {
    const msg = error.message.trim();
    if (msg) return msg;
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}
