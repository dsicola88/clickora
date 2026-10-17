import { getPresellUiStrings, normalizePresellLocale, type PresellLocaleKey } from "@/lib/presellUiStrings";

/** Idioma canónico da presell (criação) — conformidade legal alinhada ao anúncio, não ao seletor do visitante. */
export function presellComplianceLanguage(
  presellLanguage: string | undefined,
  visitorLanguage?: string | undefined,
): PresellLocaleKey {
  return normalizePresellLocale(presellLanguage || visitorLanguage || "pt-BR");
}

const MIRROR_NOTE: Record<PresellLocaleKey, string> = {
  en: "The section below mirrors the merchant’s public page for reference. This URL is an independent affiliate page — purchases go through the tracked offer link, not as the brand’s official site.",
  "pt-BR":
    "A secção abaixo espelha a página pública do comerciante para consulta. Este URL é uma página de afiliado independente — a compra faz-se pelo link rastreado da oferta, não como site oficial da marca.",
  es: "La sección inferior refleja la página pública del comerciante para consulta. Esta URL es una página de afiliado independiente: la compra se hace mediante el enlace rastreado de la oferta, no como sitio oficial de la marca.",
  de: "Der Abschnitt unten spiegelt die öffentliche Händlerseite zur Orientierung. Diese URL ist eine unabhängige Affiliate-Seite — Käufe laufen über den getrackten Angebotslink, nicht als offizielle Markenseite.",
  fr: "La section ci-dessous reprend la page publique du marchand pour consultation. Cette URL est une page affiliée indépendante — l’achat se fait via le lien suivi de l’offre, pas comme site officiel de la marque.",
  it: "La sezione sotto riproduce la pagina pubblica del commerciante per consultazione. Questo URL è una pagina affiliata indipendente — l’acquisto avviene tramite il link tracciato dell’offerta, non come sito ufficiale del brand.",
  pl: "Poniższa sekcja odzwierciedla publiczną stronę sprzedawcy w celach informacyjnych. Ten adres to niezależna strona afiliacyjna — zakup odbywa się przez śledzony link oferty, a nie jako oficjalna strona marki.",
  tr: "Aşağıdaki bölüm satıcının herkese açık sayfasını bilgi amaçlı yansıtır. Bu URL bağımsız bir affiliate sayfasıdır — satın alma, markanın resmî sitesi değil, izlenen teklif bağlantısı üzerinden yapılır.",
  hi: "नीचे का भाग जानकारी के लिए विक्रेता का सार्वजनिक पेज दर्शाता है। यह URL एक स्वतंत्र affiliate पेज है — खरीद ब्रांड की आधिकारिक साइट नहीं, ट्रैक किए गए ऑफ़र लिंक से होती है।",
  ar: "يعكس القسم أدناه صفحة التاجر العامة للمراجعة. هذا الرابط صفحة affiliate مستقلة — تتم عملية الشراء عبر رابط العرض المتتبع، وليس كموقع رسمي للعلامة.",
  nl: "Het gedeelte hieronder spiegelt de openbare pagina van de verkoper ter referentie. Deze URL is een onafhankelijke affiliatepagina — aankopen verlopen via de getrackte aanbiedingslink, niet als officiële site van het merk.",
  sv: "Avsnittet nedan speglar handlarens offentliga sida för referens. Denna URL är en oberoende affiliatesida — köp sker via den spårade erbjudandelänken, inte som varumärkets officiella webbplats.",
  no: "Delen nedenfor speiler selgerens offentlige side til orientering. Denne URL-en er en uavhengig affiliateside — kjøp skjer via den sporede tilbudslenken, ikke som merkevarens offisielle nettsted.",
  da: "Afsnittet nedenfor spejler forhandlerens offentlige side til reference. Denne URL er en uafhængig affiliateside — køb sker via det sporede tilbudlink, ikke som brandets officielle site.",
};

export function publicAffiliateDisclosureText(language: string | undefined): string {
  return getPresellUiStrings(presellComplianceLanguage(language)).trustDisclosure;
}

export function mirrorReferenceNoticeText(language: string | undefined): string {
  const locale = presellComplianceLanguage(language);
  return MIRROR_NOTE[locale] ?? MIRROR_NOTE.en;
}

/** Texto gravado em settings ao criar a presell — no idioma escolhido no assistente. */
export function defaultAffiliateDisclosureSetting(language: string | undefined): string {
  return getPresellUiStrings(presellComplianceLanguage(language)).trustDisclosure;
}
