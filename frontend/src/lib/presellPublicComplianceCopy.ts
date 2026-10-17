import { getPresellUiStrings, normalizePresellLocale, type PresellLocaleKey } from "@/lib/presellUiStrings";

const MIRROR_NOTE: Record<PresellLocaleKey, string> = {
  en: "The section below mirrors the merchant’s public page for reference. This URL is an independent affiliate page — purchases go through the tracked offer link, not as the brand’s official site.",
  "pt-BR":
    "A secção abaixo espelha a página pública do comerciante para consulta. Este URL é uma página de afiliado independente — a compra faz-se pelo link rastreado da oferta, não como site oficial da marca.",
  es: "La sección inferior refleja la página pública del comerciante. Esta URL es una página de afiliado independiente.",
  de: "Der Abschnitt unten spiegelt die Händlerseite. Diese URL ist eine unabhängige Affiliate-Seite.",
  fr: "La section ci-dessous reprend la page publique du marchand. Cette URL est une page affiliée indépendante.",
  it: "La sezione sotto riproduce la pagina del commerciante. Questo URL è una pagina affiliata indipendente.",
  pl: "Poniższa sekcja odzwierciedla stronę sprzedawcy. Ten adres to niezależna strona afiliacyjna.",
  tr: "Aşağıdaki bölüm satıcının sayfasını yansıtır. Bu URL bağımsız bir affiliate sayfasıdır.",
  hi: "नीचे का भाग व्यापारी पृष्ठ दर्शाता है। यह URL एक स्वतंत्र affiliate पेज है।",
  ar: "القسم أدناه يعكس صفحة التاجر. هذا الرابط صفحة affiliate مستقلة.",
  nl: "Het onderdeel hieronder spiegelt de verkoperspagina. Deze URL is een onafhankelijke affiliatepagina.",
  sv: "Avsnittet nedan speglar handlarens sida. Denna URL är en oberoende affiliatesida.",
  no: "Delen nedenfor speiler selgerens side. Denne URL-en er en uavhengig affiliateside.",
  da: "Afsnittet nedenfor spejler forhandlerens side. Denne URL er en uafhængig affiliateside.",
};

export function publicAffiliateDisclosureText(language: string | undefined): string {
  return getPresellUiStrings(language).trustDisclosure;
}

export function mirrorReferenceNoticeText(language: string | undefined): string {
  const locale = normalizePresellLocale(language);
  return MIRROR_NOTE[locale] ?? MIRROR_NOTE.en;
}
