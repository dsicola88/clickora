import type { Response } from "express";

/**
 * Página de bloqueio para visitantes filtrados pelas regras manuais do hop (`/track/r/`).
 * Descontinuado: cloak por país e «página segura» na landing — a Final URL serve o mesmo
 * conteúdo a qualquer visitante (humano, AdsBot, Googlebot).
 */
type SafeCopySettings = {
  cloakSafeTitle?: string;
  cloakSafeBody?: string;
};

function parseSettings(raw: unknown): SafeCopySettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const s = raw as Record<string, unknown>;
  return {
    cloakSafeTitle: typeof s.cloakSafeTitle === "string" ? s.cloakSafeTitle : undefined,
    cloakSafeBody: typeof s.cloakSafeBody === "string" ? s.cloakSafeBody : undefined,
  };
}

export function safeCopyFromSettings(settingsRaw: unknown): { title: string; body: string } {
  const settings = parseSettings(settingsRaw);
  const title = (settings.cloakSafeTitle || "").trim() || "Informação";
  const body =
    (settings.cloakSafeBody || "").trim() ||
    "Conteúdo informativo. Para mais detalhes, contacte o responsável pela página.";
  return { title, body };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function safeVisitorHtml(title: string, body: string): string {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${safeTitle}</title></head><body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5"><h1>${safeTitle}</h1><p>${safeBody}</p></body></html>`;
}

/** Visitante filtrado: HTML sem hoplink. O motivo fica no log, não na página. */
export function sendSafeVisitorPage(res: Response, settingsRaw: unknown): void {
  const copy = safeCopyFromSettings(settingsRaw);
  res.status(403).type("html").send(safeVisitorHtml(copy.title, copy.body));
}
