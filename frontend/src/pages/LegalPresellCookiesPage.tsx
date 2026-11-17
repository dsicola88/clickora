import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LegalDocLayout } from "@/components/legal/LegalDocLayout";
import { LegalSupportContact } from "@/components/legal/LegalSupportContact";
import { SITE_LEGAL_NAME } from "@/lib/siteLegal";
import { normalizePresellLocale } from "@/lib/presellUiStrings";

type CookieDoc = {
  title: string;
  updated: string;
  lead: string;
  sections: { h: string; p: string }[];
};

const DOCS: Record<string, CookieDoc> = {
  en: {
    title: "Cookie notice (offer pages)",
    updated: "November 2026",
    lead: `This notice explains cookies and similar technologies that may run on public offer pages (presells) published with ${SITE_LEGAL_NAME}. It is not the privacy policy of a product brand or merchant checkout.`,
    sections: [
      {
        h: "1. Who this applies to",
        p: "It applies to visitors of affiliate offer pages hosted or tracked through the platform. The merchant’s own site may have a separate privacy and cookie policy after you continue to the offer.",
      },
      {
        h: "2. Essential / technical storage",
        p: "We may use local storage or similar technical storage so the cookie notice can remember that you closed or accepted it, and so the page can work (for example keeping the layout or language). These are needed for the page to function as intended.",
      },
      {
        h: "3. Clickora measurement",
        p: "Offer pages may load a Clickora impression pixel and use tracked redirects (for example /track/r/) when you click through to the offer. This supports visit and click measurement for the page operator and attribution of sales when configured.",
      },
      {
        h: "4. Advertising pixels (only if enabled)",
        p: "The page operator may enable Meta, TikTok, Google Ads/Analytics/GTM, Bing, or custom scripts. Those tools are controlled by the operator’s settings and by each provider’s own policies. If a tool is not configured on that page, it is not loaded by Clickora for that purpose.",
      },
      {
        h: "5. Your choices",
        p: "On pages with a cookie notice, Accept may unlock the page and/or continue to the offer when the operator enabled that option. Close dismisses the notice so you can read the page; it does not mean “reject all advertising cookies” unless the operator has installed a full consent manager that actually blocks non-essential tags.",
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
    lead: `Dieser Hinweis erklärt Cookies und ähnliche Technologien, die auf öffentlichen Angebotsseiten (Presells) über ${SITE_LEGAL_NAME} laufen können. Er ist nicht die Datenschutzerklärung der Produktmarke oder des Händler-Checkouts.`,
    sections: [
      {
        h: "1. Geltungsbereich",
        p: "Er gilt für Besucher von Affiliate-Angebotsseiten, die über die Plattform gehostet oder getrackt werden. Die Website des Händlers kann nach dem Weiterklick eigene Datenschutz- und Cookie-Regeln haben.",
      },
      {
        h: "2. Erforderliche / technische Speicherung",
        p: "Wir können Local Storage oder ähnliche Technik nutzen, damit der Cookie-Hinweis merkt, dass Sie ihn geschlossen oder akzeptiert haben, und damit die Seite funktioniert (z. B. Layout oder Sprache). Das ist für den bestimmungsgemäßen Betrieb nötig.",
      },
      {
        h: "3. Clickora-Messung",
        p: "Angebotsseiten können ein Clickora-Impression-Pixel laden und getrackte Weiterleitungen (z. B. /track/r/) nutzen, wenn Sie zum Angebot klicken. Das dient der Besuch-/Klickmessung für den Seitenbetreiber und der Zuordnung von Verkäufen, sofern eingerichtet.",
      },
      {
        h: "4. Werbe-Pixel (nur wenn aktiviert)",
        p: "Der Betreiber kann Meta, TikTok, Google Ads/Analytics/GTM, Bing oder eigene Skripte aktivieren. Diese Tools unterliegen den Einstellungen des Betreibers und den Richtlinien der Anbieter. Ist ein Tool auf der Seite nicht konfiguriert, lädt Clickora es dafür nicht.",
      },
      {
        h: "5. Ihre Wahlmöglichkeiten",
        p: "Bei Cookie-Hinweisen kann „Akzeptieren“ die Seite freigeben und/oder zum Angebot führen, wenn der Betreiber das so eingestellt hat. „Schließen“ blendet den Hinweis aus, damit Sie die Seite lesen können — das bedeutet nicht automatisch „alle Werbe-Cookies ablehnen“, sofern kein vollständiger Consent-Manager nicht essenzielle Tags wirklich blockiert.",
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
    lead: `Este aviso explica cookies e tecnologias semelhantes que podem correr em páginas de oferta (presells) publicadas com ${SITE_LEGAL_NAME}. Não é a política de privacidade da marca do produto nem do checkout do comerciante.`,
    sections: [
      {
        h: "1. A quem se aplica",
        p: "Aplica-se a visitantes de páginas de oferta de afiliados alojadas ou rastreadas pela plataforma. O site do comerciante pode ter política própria depois de continuar para a oferta.",
      },
      {
        h: "2. Armazenamento essencial / técnico",
        p: "Podemos usar local storage ou armazenamento técnico semelhante para o aviso de cookies lembrar que fechou ou aceitou, e para a página funcionar (por exemplo layout ou idioma). São necessários ao funcionamento previsto.",
      },
      {
        h: "3. Medição Clickora",
        p: "As páginas podem carregar um pixel de impressão Clickora e usar redirects rastreados (por exemplo /track/r/) quando clica para a oferta. Isto permite medir visitas/cliques para o operador e atribuir vendas quando configurado.",
      },
      {
        h: "4. Pixels de anúncios (só se activados)",
        p: "O operador pode activar Meta, TikTok, Google Ads/Analytics/GTM, Bing ou scripts próprios. Essas ferramentas dependem das definições do operador e das políticas de cada fornecedor. Se não estiverem configuradas nessa página, a Clickora não as carrega para esse fim.",
      },
      {
        h: "5. As suas escolhas",
        p: "Com aviso de cookies, Aceitar pode desbloquear a página e/ou seguir para a oferta se o operador activou essa opção. Fechar apenas dispensa o aviso para ler a página — não significa “rejeitar todos os cookies de publicidade”, salvo se existir um gestor de consentimento completo que bloqueie tags não essenciais.",
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
