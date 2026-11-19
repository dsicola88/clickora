import { useMemo } from "react";
import { normalizePresellLocale } from "@/lib/presellUiStrings";

type Props = {
  language: string;
  open: boolean;
  onClose: () => void;
  /**
   * @deprecated Ignorado na pública: nunca abrir merchant/SaaS noutra aba (fuga do funil).
   * O aviso fica 100% in-page.
   */
  policyUrl?: string;
};

/**
 * Texto curto e neutro para landers de afiliado.
 * Sem nome do SaaS (Clickora/dclickora) nem lista de redes de ads — isso quebra confiança na white.
 * Políticas do produto/merchant ficam no rodapé da página, não neste aviso de cookies.
 */
const COPY: Record<
  string,
  { title: string; close: string; paragraphs: string[] }
> = {
  en: {
    title: "Cookie notice",
    close: "Back",
    paragraphs: [
      "We use essential storage so this notice can remember your choice, and basic visit measurement so the page operator can see that the page loaded and that offer buttons were used.",
      "Optional advertising or analytics tools load only if the page operator enabled them and you choose Accept.",
      "Close keeps you on this page so you can keep reading and use the offer buttons. It does not send you away.",
      "Accept saves your choice. If the operator turned on redirect, Accept may continue to the product offer through the same tracked button path used on this page.",
      "Product privacy, refunds, and terms (when shown in the page footer) are from the seller and are separate from this cookie notice.",
    ],
  },
  de: {
    title: "Cookie-Hinweis",
    close: "Zurück",
    paragraphs: [
      "Wir nutzen notwendige Speicherung, damit dieser Hinweis Ihre Wahl merkt, sowie eine einfache Besuchsmessung, damit der Seitenbetreiber sieht, dass die Seite geladen wurde und Angebots-Buttons genutzt wurden.",
      "Optionale Werbe- oder Analysetools laden nur, wenn der Betreiber sie aktiviert hat und Sie „Akzeptieren“ wählen.",
      "„Schließen“ lässt Sie auf dieser Seite und Sie können weiterlesen und die Angebots-Buttons nutzen. Es führt nicht weg.",
      "„Akzeptieren“ speichert Ihre Wahl. Wenn der Betreiber die Weiterleitung aktiviert hat, kann „Akzeptieren“ zur Produkt-Offerte über denselben getrackten Pfad wie die Buttons dieser Seite fortfahren.",
      "Datenschutz, Rückgabe und AGB des Produkts (falls im Footer) kommen vom Verkäufer und sind von diesem Cookie-Hinweis getrennt.",
    ],
  },
  "pt-BR": {
    title: "Aviso de cookies",
    close: "Voltar",
    paragraphs: [
      "Usamos armazenamento essencial para este aviso lembrar a sua escolha, e medição básica de visitas para o operador ver que a página carregou e que os botões da oferta foram usados.",
      "Ferramentas opcionais de anúncios ou análise só carregam se o operador as activou e você escolher Aceitar.",
      "Fechar mantém-no nesta página para continuar a ler e usar os botões da oferta. Não o tira daqui.",
      "Aceitar guarda a sua escolha. Se o operador activou o redirecionamento, Aceitar pode continuar para a oferta do produto pelo mesmo caminho rastreado dos botões desta página.",
      "Privacidade, reembolsos e termos do produto (quando no rodapé) são do vendedor e são separados deste aviso de cookies.",
    ],
  },
};

function pick(language: string) {
  const loc = normalizePresellLocale(language);
  if (loc === "de") return COPY.de;
  if (loc === "pt-BR" || loc === "es") return COPY["pt-BR"];
  return COPY.en;
}

/** Copy partilhado SPA + export HTML (sem marca SaaS). */
export function getCookiePolicyInlineCopy(language: string) {
  return pick(language);
}

/**
 * Painel de política dentro da presell — sem link externo e sem marca SaaS.
 */
export function CookiePolicyInlineSheet({ language, open, onClose, policyUrl: _policyUrl }: Props) {
  const copy = useMemo(() => pick(language), [language]);
  void _policyUrl;

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
            <p key={p.slice(0, 28)}>{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
