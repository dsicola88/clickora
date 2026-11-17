import { useMemo } from "react";
import { normalizePresellLocale } from "@/lib/presellUiStrings";
import { SITE_LEGAL_NAME } from "@/lib/siteLegal";

type Props = {
  language: string;
  open: boolean;
  onClose: () => void;
  /** URL externa opcional — só para referência; o texto in-page evita sair da presell. */
  policyUrl?: string;
};

const COPY: Record<
  string,
  { title: string; close: string; openExternal: string; paragraphs: string[] }
> = {
  en: {
    title: "Cookie notice",
    close: "Back",
    openExternal: "Open full notice in a new tab",
    paragraphs: [
      `This page may use essential storage so the notice can remember your choice, plus ${SITE_LEGAL_NAME} visit/click measurement (impression pixel and tracked redirects) for the page operator.`,
      "Advertising pixels (Meta, TikTok, Google, Bing, or custom scripts) load only if the operator enabled them and you accept non-essential cookies.",
      "Closing the banner lets you keep reading and use offer buttons. It does not send you away from this page.",
      "Merchant privacy or checkout policies (when linked in the footer) are separate and describe the seller’s own processing.",
    ],
  },
  de: {
    title: "Cookie-Hinweis",
    close: "Zurück",
    openExternal: "Vollständigen Hinweis in neuem Tab öffnen",
    paragraphs: [
      `Diese Seite kann notwendige Speicherung nutzen, damit der Hinweis Ihre Wahl merkt, sowie ${SITE_LEGAL_NAME}-Messung (Impression-Pixel und getrackte Weiterleitungen) für den Seitenbetreiber.`,
      "Werbe-Pixel (Meta, TikTok, Google, Bing oder eigene Skripte) laden nur, wenn der Betreiber sie aktiviert hat und Sie nicht essenzielle Cookies akzeptieren.",
      "„Schließen“ lässt Sie weiterlesen und Angebots-Buttons nutzen. Es führt nicht von dieser Seite weg.",
      "Datenschutz-/Checkout-Richtlinien des Händlers (falls im Footer verlinkt) sind getrennt und beschreiben die Verarbeitung des Verkäufers.",
    ],
  },
  "pt-BR": {
    title: "Aviso de cookies",
    close: "Voltar",
    openExternal: "Abrir aviso completo noutra aba",
    paragraphs: [
      `Esta página pode usar armazenamento essencial para o aviso lembrar a sua escolha, e medição ${SITE_LEGAL_NAME} (pixel de impressão e redirects rastreados) para o operador.`,
      "Pixels de anúncios (Meta, TikTok, Google, Bing ou scripts próprios) só carregam se o operador os activou e você aceitar cookies não essenciais.",
      "Fechar o aviso permite continuar a ler e usar os botões da oferta. Não o tira desta página.",
      "Políticas do comerciante (quando no rodapé) são separadas e descrevem o tratamento do vendedor.",
    ],
  },
};

function pick(language: string) {
  const loc = normalizePresellLocale(language);
  if (loc === "de") return COPY.de;
  if (loc === "pt-BR" || loc === "es") return COPY["pt-BR"];
  return COPY.en;
}

/**
 * Painel de política dentro da presell — não navega o visitante para fora do funil.
 * URL externa (se houver) só como opção «nova aba».
 */
export function CookiePolicyInlineSheet({ language, open, onClose, policyUrl }: Props) {
  const copy = useMemo(() => pick(language), [language]);
  const external = (policyUrl || "").trim();
  const canOpenExternal =
    Boolean(external) &&
    (external.startsWith("http://") ||
      external.startsWith("https://") ||
      external.startsWith("/aviso-cookies"));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[540] flex items-end justify-center sm:items-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-policy-inline-title"
      data-testid="cookie-policy-inline-sheet"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/25"
        aria-label={copy.close}
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(78vh,560px)] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h3 id="cookie-policy-inline-title" className="text-base font-semibold text-slate-900">
            {copy.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            data-testid="cookie-policy-inline-back"
          >
            {copy.close}
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-4 text-sm leading-relaxed text-slate-600">
          {copy.paragraphs.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          {canOpenExternal ? (
            <p>
              <a
                href={external}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                {copy.openExternal}
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
