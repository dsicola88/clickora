/**
 * Textos gerados na importação de presell (servidor) — alinhados aos códigos canónicos do frontend.
 */

export type RichLocalePack = {
  subtitleFallback: string;
  cta: string;
  sectionWhy: string;
  sectionWhat: string;
  sectionFromPage: string;
  bullet1: string;
  bullet2: string;
  bullet3: string;
  urgency: string;
  richFooter: string;
};

/** Normaliza o mesmo conjunto que `normalizePresellLocale` no frontend. */
export function normalizeImporterLang(raw: string | undefined): string {
  const r = (raw || "pt-BR").trim().toLowerCase().replace(/_/g, "-");
  if (!r || r === "pt") return "pt-BR";
  if (r === "us" || r === "en" || r.startsWith("en-")) return "en";
  if (r.startsWith("es")) return "es";
  if (r.startsWith("pt-br") || r === "pt-br") return "pt-BR";
  if (r.startsWith("de")) return "de";
  if (r.startsWith("fr")) return "fr";
  if (r.startsWith("it")) return "it";
  if (r.startsWith("pl")) return "pl";
  if (r.startsWith("tr")) return "tr";
  if (r.startsWith("hi")) return "hi";
  if (r.startsWith("ar")) return "ar";
  if (r.startsWith("nl")) return "nl";
  if (r.startsWith("sv")) return "sv";
  if (r === "no" || r.startsWith("nb") || r.startsWith("nn")) return "no";
  if (r.startsWith("da")) return "da";
  return "pt-BR";
}

const RICH: Record<string, RichLocalePack> = {
  en: {
    subtitleFallback: "Key information from the official offer page",
    cta: "Order Now",
    sectionWhy: "Why it matters",
    sectionWhat: "What you will find on the official page",
    sectionFromPage: "More from the offer",
    bullet1: "Transparent offer and conditions on the official site.",
    bullet2: "You can review everything before completing your purchase.",
    bullet3: "Focus on practical results you can evaluate with calm.",
    urgency: "Availability and conditions may change — check the official page.",
    richFooter: "Continue on the official page for full details, pricing, and secure checkout.",
  },
  es: {
    subtitleFallback: "Información clave de la página oficial de la oferta",
    cta: "Quiero acceder ahora",
    sectionWhy: "Por qué importa",
    sectionWhat: "Qué encontrarás en la página oficial",
    sectionFromPage: "Más de la oferta",
    bullet1: "Oferta y condiciones transparentes en el sitio oficial.",
    bullet2: "Puedes revisar todo antes de finalizar la compra.",
    bullet3: "Enfoque en resultados prácticos que puedes evaluar con calma.",
    urgency: "La disponibilidad y las condiciones pueden cambiar — revisa la página oficial.",
    richFooter: "Continúa en la página oficial para precios completos y pago seguro.",
  },
  "pt-BR": {
    subtitleFallback: "Informações da página oficial da oferta",
    cta: "Quero aproveitar agora",
    sectionWhy: "Por que isso importa",
    sectionWhat: "O que você encontra na página oficial",
    sectionFromPage: "Mais da oferta",
    bullet1: "Oferta e condições explicadas com transparência no site oficial.",
    bullet2: "Você pode revisar todas as informações antes de concluir a compra.",
    bullet3: "Foco em resultados práticos que você pode avaliar com calma.",
    urgency: "Disponibilidade e condições podem mudar — confira na página oficial.",
    richFooter: "Continue na página oficial para preços completos e checkout seguro.",
  },
  de: {
    subtitleFallback: "Wichtige Informationen von der offiziellen Angebotsseite",
    cta: "Jetzt bestellen",
    sectionWhy: "Warum das wichtig ist",
    sectionWhat: "Was Sie auf der offiziellen Seite finden",
    sectionFromPage: "Mehr zum Angebot",
    bullet1: "Transparentes Angebot und Konditionen auf der offiziellen Website.",
    bullet2: "Sie können alles prüfen, bevor Sie den Kauf abschließen.",
    bullet3: "Fokus auf praktische Ergebnisse, die Sie in Ruhe bewerten können.",
    urgency: "Verfügbarkeit und Konditionen können sich ändern — prüfen Sie die offizielle Seite.",
    richFooter: "Gehen Sie zur offiziellen Seite für Details, Preise und sicheren Checkout.",
  },
  fr: {
    subtitleFallback: "Informations clés de la page officielle de l’offre",
    cta: "Commander maintenant",
    sectionWhy: "Pourquoi c’est important",
    sectionWhat: "Ce que vous trouverez sur la page officielle",
    sectionFromPage: "En savoir plus sur l’offre",
    bullet1: "Offre et conditions transparentes sur le site officiel.",
    bullet2: "Vous pouvez tout vérifier avant de finaliser l’achat.",
    bullet3: "Accent sur des résultats pratiques que vous pouvez évaluer sereinement.",
    urgency: "Disponibilité et conditions susceptibles de changer — consultez la page officielle.",
    richFooter: "Continuez sur la page officielle pour les détails, les prix et le paiement sécurisé.",
  },
  it: {
    subtitleFallback: "Informazioni chiave dalla pagina ufficiale dell’offerta",
    cta: "Ordina ora",
    sectionWhy: "Perché è importante",
    sectionWhat: "Cosa troverai sulla pagina ufficiale",
    sectionFromPage: "Altro sull’offerta",
    bullet1: "Offerta e condizioni trasparenti sul sito ufficiale.",
    bullet2: "Puoi verificare tutto prima di completare l’acquisto.",
    bullet3: "Focus su risultati pratici che puoi valutare con calma.",
    urgency: "Disponibilità e condizioni possono cambiare — controlla la pagina ufficiale.",
    richFooter: "Continua sulla pagina ufficiale per dettagli, prezzi e checkout sicuro.",
  },
  pl: {
    subtitleFallback: "Kluczowe informacje ze strony oficjalnej oferty",
    cta: "Zamów teraz",
    sectionWhy: "Dlaczego to ważne",
    sectionWhat: "Co znajdziesz na stronie oficjalnej",
    sectionFromPage: "Więcej o ofercie",
    bullet1: "Przejrzysta oferta i warunki na stronie oficjalnej.",
    bullet2: "Możesz wszystko sprawdzić przed zakupem.",
    bullet3: "Skupienie na praktycznych rezultatach, które możesz spokojnie ocenić.",
    urgency: "Dostępność i warunki mogą się zmienić — sprawdź stronę oficjalną.",
    richFooter: "Przejdź na stronę oficjalną po pełne szczegóły, ceny i bezpieczną płatność.",
  },
  tr: {
    subtitleFallback: "Resmi teklif sayfasından önemli bilgiler",
    cta: "Şimdi sipariş ver",
    sectionWhy: "Neden önemli",
    sectionWhat: "Resmi sayfada neler bulacaksınız",
    sectionFromPage: "Teklif hakkında daha fazla",
    bullet1: "Resmi sitede şeffaf teklif ve koşullar.",
    bullet2: "Satın almadan önce her şeyi inceleyebilirsiniz.",
    bullet3: "Sakinçe değerlendirebileceğiniz pratik sonuçlara odaklanın.",
    urgency: "Stok ve koşullar değişebilir — resmi sayfayı kontrol edin.",
    richFooter: "Ayrıntılar, fiyatlar ve güvenli ödeme için resmi sayfaya devam edin.",
  },
  hi: {
    subtitleFallback: "आधिकारिक ऑफ़र पृष्ठ से मुख्य जानकारी",
    cta: "अभी ऑर्डर करें",
    sectionWhy: "यह क्यों मायने रखता है",
    sectionWhat: "आधिकारिक पृष्ठ पर आपको क्या मिलेगा",
    sectionFromPage: "ऑफ़र के बारे में और",
    bullet1: "आधिकारिक साइट पर पारदाना ऑफ़र और शर्तें।",
    bullet2: "खरीद पूरी करने से पहले आप सब कुछ देख सकते हैं।",
    bullet3: "व्यावहारिक परिणामों पर ध्यान जिन्हें आप शांति से आंक सकते हैं।",
    urgency: "उपलब्धता और शर्तें बदल सकती हैं — आधिकारिक पृष्ठ देखें।",
    richFooter: "पूर्ण विवरण, मूल्य और सुरक्षित चेकआउट के लिए आधिकारिक पृष्ठ पर जारी रखें।",
  },
  ar: {
    subtitleFallback: "معلومات رئيسية من الصفحة الرسمية للعرض",
    cta: "اطلب الآن",
    sectionWhy: "لماذا يهم",
    sectionWhat: "ما ستجده في الصفحة الرسمية",
    sectionFromPage: "المزيد عن العرض",
    bullet1: "عرض وشروط واضحة على الموقع الرسمي.",
    bullet2: "يمكنك مراجعة كل شيء قبل إتمام الشراء.",
    bullet3: "تركيز على نتائج عملية يمكنك تقييمها بهدوء.",
    urgency: "قد تتغير التوفر والشروط — راجع الصفحة الرسمية.",
    richFooter: "تابع إلى الصفحة الرسمية للتفاصيل والأسعار والدفع الآمن.",
  },
  nl: {
    subtitleFallback: "Belangrijke informatie van de officiële aanbiedingspagina",
    cta: "Nu bestellen",
    sectionWhy: "Waarom het telt",
    sectionWhat: "Wat u op de officiële pagina vindt",
    sectionFromPage: "Meer over de aanbieding",
    bullet1: "Transparante aanbieding en voorwaarden op de officiële site.",
    bullet2: "U kunt alles controleren voordat u afrekent.",
    bullet3: "Focus op praktische resultaten die u rustig kunt beoordelen.",
    urgency: "Beschikbaarheid en voorwaarden kunnen wijzigen — bekijk de officiële pagina.",
    richFooter: "Ga verder naar de officiële pagina voor details, prijzen en veilige checkout.",
  },
  sv: {
    subtitleFallback: "Nyckelinformation från den officiella erbjudandesidan",
    cta: "Beställ nu",
    sectionWhy: "Varför det spelar roll",
    sectionWhat: "Vad du hittar på den officiella sidan",
    sectionFromPage: "Mer om erbjudandet",
    bullet1: "Transparent erbjudande och villkor på den officiella webbplatsen.",
    bullet2: "Du kan granska allt innan du slutför köpet.",
    bullet3: "Fokus på praktiska resultat som du kan utvärdera i lugn och ro.",
    urgency: "Tillgänglighet och villkor kan ändras — kontrollera den officiella sidan.",
    richFooter: "Fortsätt till den officiella sidan för detaljer, priser och säker kassa.",
  },
  no: {
    subtitleFallback: "Nøkkelinformasjon fra det offisielle tilbudssiden",
    cta: "Bestill nå",
    sectionWhy: "Hvorfor det betyr noe",
    sectionWhat: "Hva du finner på den offisielle siden",
    sectionFromPage: "Mer om tilbudet",
    bullet1: "Transparent tilbud og vilkår på det offisielle nettstedet.",
    bullet2: "Du kan gjennomgå alt før du fullfører kjøpet.",
    bullet3: "Fokus på praktiske resultater du kan vurdere med ro.",
    urgency: "Tilgjengelighet og vilkår kan endres — sjekk den offisielle siden.",
    richFooter: "Gå videre til den offisielle siden for detaljer, priser og sikker utsjekking.",
  },
  da: {
    subtitleFallback: "Nøgleinformation fra den officielle tilbudsside",
    cta: "Bestil nu",
    sectionWhy: "Hvorfor det betyder noget",
    sectionWhat: "Hvad du finder på den officielle side",
    sectionFromPage: "Mere om tilbuddet",
    bullet1: "Gennemsigtigt tilbud og vilkår på det officielle website.",
    bullet2: "Du kan gennemgå alt, før du gennemfører købet.",
    bullet3: "Fokus på praktiske resultater, du kan vurdere i ro og mag.",
    urgency: "Tilgængelighed og vilkår kan ændres — tjek den officielle side.",
    richFooter: "Fortsæt til den officielle side for detaljer, priser og sikker betaling.",
  },
};

export function localePack(language: string): RichLocalePack {
  const k = normalizeImporterLang(language);
  return RICH[k] ?? RICH.en;
}

export function buildDiscountHeadline(percent: number | null, language: string): string {
  const k = normalizeImporterLang(language);
  if (percent != null && percent >= 5) {
    const off: Record<string, string> = {
      en: `Up to ${percent}% OFF`,
      es: `Hasta ${percent}% OFF`,
      "pt-BR": `Até ${percent}% OFF`,
      de: `Bis zu ${percent}% RABATT`,
      fr: `Jusqu'à ${percent}% de réduction`,
      it: `Fino al ${percent}% di sconto`,
      pl: `Do ${percent}% taniej`,
      tr: `%${percent}'e varan indirim`,
      hi: `${percent}% तक की छूट`,
      ar: `خصم يصل إلى ${percent}٪`,
      nl: `Tot ${percent}% korting`,
      sv: `Upp till ${percent}% rabatt`,
      no: `Opptil ${percent}% rabatt`,
      da: `Op til ${percent}% rabat`,
    };
    return off[k] ?? off.en;
  }
  const limited: Record<string, string> = {
    en: "Limited time offer",
    es: "Oferta por tiempo limitado",
    "pt-BR": "Oferta por tempo limitado",
    de: "Zeitlich begrenztes Angebot",
    fr: "Offre à durée limitée",
    it: "Offerta a tempo limitato",
    pl: "Oferta ograniczona czasowo",
    tr: "Süreli teklif",
    hi: "सीमित समय का ऑफ़र",
    ar: "عرض لفترة محدودة",
    nl: "Tijdelijk aanbod",
    sv: "Tidsbegränsat erbjudande",
    no: "Tidsbegrenset tilbud",
    da: "Tidsbegrænset tilbud",
  };
  return limited[k] ?? limited.en;
}

export function socialProofFallback(language: string): string {
  const k = normalizeImporterLang(language);
  const m: Record<string, string> = {
    en: "8 out of 10 people prefer our product",
    es: "8 de cada 10 personas prefieren nuestro producto",
    "pt-BR": "8 em cada 10 pessoas preferem o nosso produto",
    de: "8 von 10 Personen bevorzugen unser Produkt",
    fr: "8 personnes sur 10 préfèrent notre produit",
    it: "8 persone su 10 preferiscono il nostro prodotto",
    pl: "8 na 10 osób wybiera nasz produkt",
    tr: "10 kişiden 8'i ürünümüzü tercih ediyor",
    hi: "10 में से 8 लोग हमारे उत्पाद को पसंद करते हैं",
    ar: "8 من كل 10 يفضلون منتجنا",
    nl: "8 van de 10 mensen geven de voorkeur aan ons product",
    sv: "8 av 10 föredrar vår produkt",
    no: "8 av 10 foretrekker vårt produkt",
    da: "8 ud af 10 foretrækker vores produkt",
  };
  return m[k] ?? m.en;
}

export function officialBuyCta(language: string): string {
  const k = normalizeImporterLang(language);
  const m: Record<string, string> = {
    en: "Buy on the Official Website",
    es: "Comprar en el sitio oficial",
    "pt-BR": "Comprar no site oficial",
    de: "Auf der offiziellen Website kaufen",
    fr: "Acheter sur le site officiel",
    it: "Acquista sul sito ufficiale",
    pl: "Kup na oficjalnej stronie",
    tr: "Resmi siteden satın al",
    hi: "आधिकारिक वेबसाइट पर खरीदें",
    ar: "الشراء من الموقع الرسمي",
    nl: "Koop op de officiële website",
    sv: "Köp på den officiella webbplatsen",
    no: "Kjøp på den offisielle nettsiden",
    da: "Køb på den officielle hjemmeside",
  };
  return m[k] ?? m.en;
}

export function referencePriceLineRich(lang: string, price: string): string {
  const k = normalizeImporterLang(lang);
  if (!price) return "";
  const m: Record<string, string> = {
    en: `\n\nReference price on the official page: ${price}.`,
    es: `\n\nReferencia de precio en la página oficial: ${price}.`,
    "pt-BR": `\n\nReferência de valor na página oficial: ${price}.`,
    de: `\n\nReferenzpreis auf der offiziellen Seite: ${price}.`,
    fr: `\n\nPrix de référence sur la page officielle : ${price}.`,
    it: `\n\nPrezzo di riferimento sulla pagina ufficiale: ${price}.`,
    pl: `\n\nCena referencyjna na stronie oficjalnej: ${price}.`,
    tr: `\n\nResmi sayfadaki referans fiyat: ${price}.`,
    hi: `\n\nआधिकारिक पृष्ठ पर संदर्भ मूल्य: ${price}.`,
    ar: `\n\nالسعر المرجعي في الصفحة الرسمية: ${price}.`,
    nl: `\n\nReferentieprijs op de officiële pagina: ${price}.`,
    sv: `\n\nReferenspris på den officiella sidan: ${price}.`,
    no: `\n\nReferansepris på den offisielle siden: ${price}.`,
    da: `\n\nReferencepris på den officielle side: ${price}.`,
  };
  return m[k] ?? m["pt-BR"];
}

export function referencePriceLineCompact(lang: string, price: string): string {
  const k = normalizeImporterLang(lang);
  if (!price) return "";
  const m: Record<string, string> = {
    en: `Offer reference on the official page: ${price}.`,
    es: `Referencia de precio en la página oficial: ${price}.`,
    "pt-BR": `Referência de valor na página oficial: ${price}.`,
    de: `Referenzangebot auf der offiziellen Seite: ${price}.`,
    fr: `Référence d’offre sur la page officielle : ${price}.`,
    it: `Riferimento offerta sulla pagina ufficiale: ${price}.`,
    pl: `Referencja oferty na stronie oficjalnej: ${price}.`,
    tr: `Resmi sayfadaki teklif referansı: ${price}.`,
    hi: `आधिकारिक पृष्ठ पर ऑफ़र संदर्भ: ${price}.`,
    ar: `مرجع العرض في الصفحة الرسمية: ${price}.`,
    nl: `Aanbiedingsreferentie op de officiële pagina: ${price}.`,
    sv: `Erbjudandereferens på den officiella sidan: ${price}.`,
    no: `Tilbudsreferanse på den offisielle siden: ${price}.`,
    da: `Tilbudsreference på den officielle side: ${price}.`,
  };
  return m[k] ?? m["pt-BR"];
}
