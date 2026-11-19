import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LegalDocLayout } from "@/components/legal/LegalDocLayout";
import { LegalSupportContact } from "@/components/legal/LegalSupportContact";
import { normalizePresellLocale } from "@/lib/presellUiStrings";

type CookieDoc = {
  title: string;
  updated: string;
  lead: string;
  sections: { h: string; p: string }[];
};

/** Texto neutro para visitantes da oferta — sem marca SaaS nem redes de ads (evita fuga de confiança). */
const DOCS: Record<string, CookieDoc> = {
  en: {
    title: "Cookie notice (offer pages)",
    updated: "November 2026",
    lead: "This notice explains cookies and similar technologies that may run on this public offer page. It is not the privacy policy of the product brand or merchant checkout.",
    sections: [
      {
        h: "1. Who this applies to",
        p: "It applies to visitors of this offer page. The merchant’s own site may have a separate privacy and cookie policy after you continue to the offer.",
      },
      {
        h: "2. Essential / technical storage",
        p: "We may use local storage or similar technical storage so the cookie notice can remember that you closed or accepted it, and so the page can work (for example keeping the layout or language). These are needed for the page to function as intended.",
      },
      {
        h: "3. Visit and click measurement",
        p: "This page may load a basic impression pixel and use tracked redirects when you click through to the offer. That helps the page operator measure visits and clicks and attribute sales when configured.",
      },
      {
        h: "4. Optional advertising or analytics tools",
        p: "The page operator may enable optional advertising or analytics tools. Those tools load only when configured on this page and, on cookie-gated pages, after you choose Accept. Each provider’s own policies also apply.",
      },
      {
        h: "5. Your choices",
        p: "On pages with a cookie notice, Accept records consent for non-essential tools when the operator enabled them. Close keeps essential storage and basic visit measurement only and never sends you away — you stay on this page and can still use the offer buttons. Accept may continue to the product offer only if the operator turned on that redirect; otherwise purchase always uses the page’s offer buttons (tracked paths preserve UTMs and click IDs when present).",
      },
      {
        h: "6. Merchant policies",
        p: "Links to the producer’s privacy, terms, refund or shipping pages—when available—are separate from this cookie notice and describe the merchant’s own processing.",
      },
    ],
  },
  de: {
    title: "Cookie-Hinweis (Angebotsseiten)",
    updated: "November 2026",
    lead: "Dieser Hinweis erklärt Cookies und ähnliche Technologien auf dieser öffentlichen Angebotsseite. Er ist nicht die Datenschutzerklärung der Produktmarke oder des Händler-Checkouts.",
    sections: [
      {
        h: "1. Geltungsbereich",
        p: "Er gilt für Besucher dieser Angebotsseite. Die Website des Händlers kann nach dem Weiterklick eigene Datenschutz- und Cookie-Regeln haben.",
      },
      {
        h: "2. Erforderliche / technische Speicherung",
        p: "Wir können Local Storage oder ähnliche Technik nutzen, damit der Cookie-Hinweis merkt, dass Sie ihn geschlossen oder akzeptiert haben, und damit die Seite funktioniert (z. B. Layout oder Sprache). Das ist für den bestimmungsgemäßen Betrieb nötig.",
      },
      {
        h: "3. Besuch- und Klickmessung",
        p: "Diese Seite kann ein einfaches Impression-Pixel laden und getrackte Weiterleitungen nutzen, wenn Sie zum Angebot klicken. So kann der Seitenbetreiber Besuche/Klicks messen und Verkäufe zuordnen, sofern eingerichtet.",
      },
      {
        h: "4. Optionale Werbe- oder Analysetools",
        p: "Der Betreiber kann optionale Werbe- oder Analysetools aktivieren. Sie laden nur, wenn sie auf dieser Seite konfiguriert sind und — bei Cookie-Hinweisen — nach „Akzeptieren“. Es gelten auch die Richtlinien der jeweiligen Anbieter.",
      },
      {
        h: "5. Ihre Wahlmöglichkeiten",
        p: "Bei Cookie-Hinweisen speichert „Akzeptieren“ die Zustimmung für nicht essenzielle Tools, sofern der Betreiber sie aktiviert hat. „Schließen“ belässt nur essenzielle Speicherung und einfache Besuchsmessung und führt nicht weg — Sie bleiben auf der Seite und können die Angebots-Buttons weiter nutzen. „Akzeptieren“ leitet nur zur Produkt-Offerte weiter, wenn der Betreiber diese Weiterleitung aktiviert hat; sonst läuft der Kauf über die Buttons der Seite (getrackte Pfade behalten UTMs und Klick-IDs, sofern vorhanden).",
      },
      {
        h: "6. Richtlinien des Händlers",
        p: "Links zur Datenschutz-, AGB-, Widerrufs- oder Versandseite des Produzenten sind — soweit vorhanden — getrennt von diesem Cookie-Hinweis und beschreiben die Verarbeitung des Händlers.",
      },
    ],
  },
  "pt-BR": {
    title: "Aviso de cookies (páginas de oferta)",
    updated: "Novembro de 2026",
    lead: "Este aviso explica cookies e tecnologias semelhantes nesta página pública de oferta. Não é a política de privacidade da marca do produto nem do checkout do comerciante.",
    sections: [
      {
        h: "1. A quem se aplica",
        p: "Aplica-se a visitantes desta página de oferta. O site do comerciante pode ter política própria depois de continuar para a oferta.",
      },
      {
        h: "2. Armazenamento essencial / técnico",
        p: "Podemos usar local storage ou armazenamento técnico semelhante para o aviso de cookies lembrar que fechou ou aceitou, e para a página funcionar (por exemplo layout ou idioma). São necessários ao funcionamento previsto.",
      },
      {
        h: "3. Medição de visitas e cliques",
        p: "Esta página pode carregar um pixel simples de impressão e usar redirects rastreados quando clica para a oferta. Isto ajuda o operador a medir visitas/cliques e atribuir vendas quando configurado.",
      },
      {
        h: "4. Ferramentas opcionais de anúncios ou análise",
        p: "O operador pode activar ferramentas opcionais de anúncios ou análise. Só carregam se estiverem configuradas nesta página e, em páginas com aviso de cookies, depois de Aceitar. Aplicam-se também as políticas de cada fornecedor.",
      },
      {
        h: "5. As suas escolhas",
        p: "Com aviso de cookies, Aceitar regista o consentimento para ferramentas não essenciais (se o operador as activou). Fechar mantém só armazenamento essencial e medição básica de visitas e nunca o tira da página — continua a poder usar os botões da oferta. Aceitar só continua para a oferta do produto se o operador activou esse redirecionamento; caso contrário a compra é sempre pelos botões da página (caminhos rastreados preservam UTMs e IDs de clique quando existem).",
      },
      {
        h: "6. Políticas do comerciante",
        p: "Links para privacidade, termos, reembolso ou envio do produtor — quando existirem — são separados deste aviso e descrevem o tratamento do comerciante.",
      },
    ],
  },
};

function pickDoc(raw: string | null): CookieDoc {
  const loc = normalizePresellLocale(raw || undefined);
  if (loc === "de") return DOCS.de;
  if (loc === "pt-BR" || loc === "es") return DOCS["pt-BR"];
  return DOCS.en;
}

/** Política de cookies das presells públicas — distinta de /privacidade (contas SaaS). */
export default function LegalPresellCookiesPage() {
  const [params] = useSearchParams();
  const doc = useMemo(
    () => pickDoc(params.get("lang") || (typeof navigator !== "undefined" ? navigator.language : "en")),
    [params],
  );

  return (
    <LegalDocLayout title={doc.title}>
      <p className="lead text-muted-foreground text-base not-prose mb-8">
        {doc.updated}. {doc.lead}
      </p>
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          <p>{s.p}</p>
        </section>
      ))}
      <LegalSupportContact />
    </LegalDocLayout>
  );
}
