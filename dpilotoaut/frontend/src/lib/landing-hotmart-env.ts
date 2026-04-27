/**
 * URLs reais de checkout Hotmart a partir de variáveis de ambiente do servidor.
 * Substituem apenas valores ainda "genéricos" (placeholder pay.hotmart.com, vazio ou #).
 */
import type { LandingDocument } from "./landing-document";

function isHotmartPlaceholder(href: string | undefined | null): boolean {
  const u = String(href ?? "")
    .trim()
    .toLowerCase();
  if (!u || u === "#") return true;
  if (u === "https://pay.hotmart.com" || u === "https://pay.hotmart.com/") return true;
  if (u === "http://pay.hotmart.com" || u === "http://pay.hotmart.com/") return true;
  return false;
}

function cloneDoc(doc: LandingDocument): LandingDocument {
  if (typeof structuredClone === "function") return structuredClone(doc);
  return JSON.parse(JSON.stringify(doc)) as LandingDocument;
}

/**
 * Aplica `HOTMART_CHECKOUT_MONTHLY` / `QUARTERLY` / `ANNUAL` e opcionalmente
 * `HOTMART_CHECKOUT_FREE_TRIAL` ao bloco de preços (só quando o link guardado ainda é placeholder).
 * Chamado no servidor (ex. `getPublishedLanding`, criação de landing).
 */
export function applyHotmartEnvToLandingDocument(doc: LandingDocument): LandingDocument {
  const m = process.env.HOTMART_CHECKOUT_MONTHLY?.trim();
  const q = process.env.HOTMART_CHECKOUT_QUARTERLY?.trim();
  const a = process.env.HOTMART_CHECKOUT_ANNUAL?.trim();
  const free = process.env.HOTMART_CHECKOUT_FREE_TRIAL?.trim();
  if (!m && !q && !a && !free) return doc;

  const next = cloneDoc(doc);
  for (const sec of next.sections) {
    for (const w of sec.children) {
      if (w.type !== "pricing") continue;
      const s = w.settings as Record<string, unknown>;
      if (m && isHotmartPlaceholder(s.checkoutMonthly as string | undefined)) s.checkoutMonthly = m;
      if (q && isHotmartPlaceholder(s.checkoutQuarterly as string | undefined)) s.checkoutQuarterly = q;
      if (a && isHotmartPlaceholder(s.checkoutAnnual as string | undefined)) s.checkoutAnnual = a;
      if (free) {
        const ft = s.freeTrial;
        if (ft && typeof ft === "object" && !Array.isArray(ft)) {
          const fto = ft as Record<string, unknown>;
          if (isHotmartPlaceholder(fto.checkoutUrl as string | undefined)) {
            fto.checkoutUrl = free;
          }
        }
      }
    }
  }
  return next;
}
