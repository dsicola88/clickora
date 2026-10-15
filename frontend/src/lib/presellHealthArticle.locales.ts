import type { PresellLocaleKey } from "./presellUiStrings.types";

export type HealthArticlePack = {
  kicker: string;
  /** `{name}` = nome do produto. */
  headline: string;
  intro: string;
  pillarsTitle: string;
  pillars: { title: string; body: string }[];
  productNote: string;
  ctaLabel: string;
};

const seller = (title: string, body: string) => ({ title, body });

export const HEALTH_ARTICLE_PACKS: Record<PresellLocaleKey, HealthArticlePack> = {
  en: {
    kicker: "Informational page",
    headline: "How to review the {name} offer with transparency",
    intro:
      "This page is independent information about {name}. We are not the manufacturer, we do not process payments, and we do not replace the product sheet, the label, or the seller’s support. The goal is to help you decide calmly before you continue to the offer site.",
    pillarsTitle: "What to confirm on the official site",
    pillars: [
      seller(
        "Seller identity",
        "Confirm the business name, contact, and published policies on the offer destination before you complete any purchase.",
      ),
      seller(
        "Price, shipping, and guarantee",
        "Amounts, timelines, returns, and payment terms are valid only when shown at the merchant’s official checkout.",
      ),
      seller(
        "Ingredients and product notices",
        "Ingredients, how to use, and health notices must be read on the manufacturer’s page and label. This page does not copy or invent that information.",
      ),
    ],
    productNote:
      "If you want to see the commercial offer for {name}, use the button below to open the official offer page. We may earn a referral commission if a purchase is made, at no extra cost to you.",
    ctaLabel: "Continue to the official offer page",
  },
  es: {
    kicker: "Página informativa",
    headline: "Cómo valorar la oferta de {name} con transparencia",
    intro:
      "Esta página es información independiente sobre {name}. No somos el fabricante, no procesamos pagos y no sustituimos la ficha, la etiqueta ni la atención del vendedor. El objetivo es ayudarte a decidir con calma antes de seguir al sitio de la oferta.",
    pillarsTitle: "Qué confirmar en el sitio oficial",
    pillars: [
      seller(
        "Identidad del vendedor",
        "Confirma el nombre comercial, el contacto y las políticas publicadas en el destino de la oferta antes de completar cualquier compra.",
      ),
      seller(
        "Precio, envío y garantía",
        "Importes, plazos, devoluciones y condiciones de pago solo son válidos cuando aparecen en el checkout oficial del comerciante.",
      ),
      seller(
        "Composición y avisos del producto",
        "Ingredientes, modo de uso y avisos de salud deben leerse en la página y en la etiqueta del fabricante. Esta página no copia ni inventa esa información.",
      ),
    ],
    productNote:
      "Si quieres ver la propuesta comercial de {name}, usa el botón de abajo para abrir la página oficial de la oferta. Podemos recibir una comisión por referencia si se realiza una compra, sin coste extra para ti.",
    ctaLabel: "Continuar a la página oficial de la oferta",
  },
  "pt-BR": {
    kicker: "Portal informativo",
    headline: "Como avaliar a oferta de {name} com transparência",
    intro:
      "Esta página é um conteúdo informativo independente sobre {name}. Não somos o fabricante, não processamos pagamentos e não substituímos a ficha técnica, o rótulo nem o atendimento do vendedor. O objetivo é ajudar o visitante a decidir com calma antes de seguir para o site da oferta.",
    pillarsTitle: "O que deve confirmar no site oficial",
    pillars: [
      seller(
        "Identidade do vendedor",
        "Confirme o nome comercial, contacto e políticas publicadas no destino da oferta antes de concluir qualquer compra.",
      ),
      seller(
        "Preço, envio e garantia",
        "Valores, prazos, devoluções e condições de pagamento só são válidos quando apresentados no checkout oficial do comerciante.",
      ),
      seller(
        "Composição e avisos do produto",
        "Ingredientes, modo de uso e avisos de saúde devem ser lidos na página e no rótulo do fabricante — esta página não reproduz nem inventa essas informações.",
      ),
    ],
    productNote:
      "Se quiser conhecer a proposta comercial de {name}, utilize o botão abaixo para abrir a página oficial da oferta. Podemos receber comissão por indicação caso uma compra seja efetuada — sem custo adicional para si.",
    ctaLabel: "Continuar para a página oficial da oferta",
  },
  de: {
    kicker: "Informationsseite",
    headline: "Das Angebot von {name} transparent prüfen",
    intro:
      "Diese Seite enthält unabhängige Informationen zu {name}. Wir sind nicht der Hersteller, wir verarbeiten keine Zahlungen und ersetzen weder Datenblatt, Etikett noch den Support des Verkäufers. Ziel ist eine ruhige Entscheidung, bevor Sie zur Angebotsseite weitergehen.",
    pillarsTitle: "Was Sie auf der offiziellen Website prüfen sollten",
    pillars: [
      seller(
        "Identität des Verkäufers",
        "Prüfen Sie Firmenname, Kontakt und veröffentlichte Richtlinien auf der Angebotsseite, bevor Sie einen Kauf abschließen.",
      ),
      seller(
        "Preis, Versand und Garantie",
        "Beträge, Fristen, Rückgaben und Zahlungsbedingungen gelten nur, wenn sie im offiziellen Checkout des Händlers stehen.",
      ),
      seller(
        "Zusammensetzung und Hinweise",
        "Inhaltsstoffe, Anwendung und Gesundheitshinweise stehen auf der Seite und dem Etikett des Herstellers. Diese Seite kopiert oder erfindet diese Angaben nicht.",
      ),
    ],
    productNote:
      "Wenn Sie das kommerzielle Angebot von {name} sehen möchten, öffnen Sie über die Schaltfläche die offizielle Angebotsseite. Bei einem Kauf können wir eine Vermittlungsprovision erhalten — ohne Mehrkosten für Sie.",
    ctaLabel: "Weiter zur offiziellen Angebotsseite",
  },
  fr: {
    kicker: "Page d’information",
    headline: "Comment examiner l’offre {name} en toute transparence",
    intro:
      "Cette page est une information indépendante sur {name}. Nous ne sommes pas le fabricant, nous n’encaissons pas les paiements et nous ne remplaçons ni la fiche, ni l’étiquette, ni le support du vendeur. Le but est de vous aider à décider calmement avant d’aller sur le site de l’offre.",
    pillarsTitle: "Ce qu’il faut confirmer sur le site officiel",
    pillars: [
      seller(
        "Identité du vendeur",
        "Vérifiez la raison sociale, le contact et les politiques publiées sur la destination de l’offre avant tout achat.",
      ),
      seller(
        "Prix, livraison et garantie",
        "Montants, délais, retours et conditions de paiement ne valent que s’ils figurent au paiement officiel du marchand.",
      ),
      seller(
        "Composition et avertissements",
        "Ingrédients, mode d’emploi et avertissements de santé se lisent sur la page et l’étiquette du fabricant. Cette page ne recopie ni n’invente ces informations.",
      ),
    ],
    productNote:
      "Pour voir l’offre commerciale de {name}, utilisez le bouton ci-dessous pour ouvrir la page officielle. Nous pouvons recevoir une commission d’indication si un achat est effectué, sans frais supplémentaires pour vous.",
    ctaLabel: "Continuer vers la page officielle de l’offre",
  },
  it: {
    kicker: "Pagina informativa",
    headline: "Come valutare l’offerta di {name} con trasparenza",
    intro:
      "Questa pagina è un’informazione indipendente su {name}. Non siamo il produttore, non elaboriamo pagamenti e non sostituiamo la scheda, l’etichetta né l’assistenza del venditore. L’obiettivo è aiutarti a decidere con calma prima di andare al sito dell’offerta.",
    pillarsTitle: "Cosa confermare sul sito ufficiale",
    pillars: [
      seller(
        "Identità del venditore",
        "Conferma ragione sociale, contatto e politiche pubblicate sulla destinazione dell’offerta prima di completare un acquisto.",
      ),
      seller(
        "Prezzo, spedizione e garanzia",
        "Importi, tempi, resi e condizioni di pagamento valgono solo se indicati nel checkout ufficiale del commerciante.",
      ),
      seller(
        "Composizione e avvertenze",
        "Ingredienti, uso e avvertenze sanitarie vanno letti sulla pagina e sull’etichetta del produttore. Questa pagina non copia né inventa quelle informazioni.",
      ),
    ],
    productNote:
      "Se vuoi vedere la proposta commerciale di {name}, usa il pulsante qui sotto per aprire la pagina ufficiale dell’offerta. Possiamo ricevere una commissione di segnalazione se viene effettuato un acquisto, senza costi extra per te.",
    ctaLabel: "Continua alla pagina ufficiale dell’offerta",
  },
  pl: {
    kicker: "Strona informacyjna",
    headline: "Jak ocenić ofertę {name} w sposób przejrzysty",
    intro:
      "Ta strona to niezależna informacja o {name}. Nie jesteśmy producentem, nie obsługujemy płatności i nie zastępujemy karty produktu, etykiety ani obsługi sprzedawcy. Celem jest spokojna decyzja, zanim przejdziesz na stronę oferty.",
    pillarsTitle: "Co potwierdzić na oficjalnej stronie",
    pillars: [
      seller(
        "Tożsamość sprzedawcy",
        "Potwierdź nazwę firmy, kontakt i opublikowane zasady na stronie oferty, zanim dokonasz zakupu.",
      ),
      seller(
        "Cena, wysyłka i gwarancja",
        "Kwoty, terminy, zwroty i warunki płatności są ważne tylko wtedy, gdy są podane w oficjalnym checkoutcie sprzedawcy.",
      ),
      seller(
        "Skład i ostrzeżenia",
        "Składniki, sposób użycia i ostrzeżenia zdrowotne czytaj na stronie i etykiecie producenta. Ta strona ich nie kopiuje ani nie wymyśla.",
      ),
    ],
    productNote:
      "Jeśli chcesz zobaczyć ofertę handlową {name}, użyj przycisku poniżej, aby otworzyć oficjalną stronę oferty. Możemy otrzymać prowizję za polecenie, jeśli dojdzie do zakupu — bez dodatkowych kosztów dla Ciebie.",
    ctaLabel: "Przejdź do oficjalnej strony oferty",
  },
  tr: {
    kicker: "Bilgi sayfası",
    headline: "{name} teklifini şeffaf biçimde nasıl değerlendirirsiniz",
    intro:
      "Bu sayfa {name} hakkında bağımsız bir bilgilendirmedir. Üretici değiliz, ödeme almıyoruz ve ürün kartının, etiketin veya satıcı desteğinin yerine geçmeyiz. Amaç, teklif sitesine geçmeden önce sakin bir karar vermenize yardımcı olmaktır.",
    pillarsTitle: "Resmi sitede doğrulanacaklar",
    pillars: [
      seller(
        "Satıcının kimliği",
        "Satın almayı tamamlamadan önce teklif sayfasındaki ticari unvanı, iletişimi ve yayımlanmış politikaları doğrulayın.",
      ),
      seller(
        "Fiyat, kargo ve garanti",
        "Tutarlar, süreler, iadeler ve ödeme koşulları yalnızca satıcının resmi ödemesinde göründüğünde geçerlidir.",
      ),
      seller(
        "İçerik ve uyarılar",
        "İçindekiler, kullanım ve sağlık uyarıları üreticinin sayfasında ve etiketinde okunmalıdır. Bu sayfa bu bilgileri kopyalamaz veya uydurmaz.",
      ),
    ],
    productNote:
      "{name} ticari teklifini görmek için aşağıdaki düğmeyle resmi teklif sayfasını açın. Bir satın alma olursa yönlendirme komisyonu alabiliriz — sizin için ek ücret yoktur.",
    ctaLabel: "Resmi teklif sayfasına devam et",
  },
  hi: {
    kicker: "सूचना पृष्ठ",
    headline: "{name} की पेशकश को पारदर्शिता से कैसे जाँचें",
    intro:
      "यह पृष्ठ {name} के बारे में स्वतंत्र जानकारी है। हम निर्माता नहीं हैं, भुगतान नहीं लेते, और उत्पाद पत्रक, लेबल या विक्रेता की सहायता की जगह नहीं लेते। उद्देश्य है कि आप पेशकश की साइट पर जाने से पहले शांति से निर्णय लें।",
    pillarsTitle: "आधिकारिक साइट पर क्या पुष्टि करें",
    pillars: [
      seller(
        "विक्रेता की पहचान",
        "कोई खरीद पूरी करने से पहले पेशकश गंतव्य पर व्यापारिक नाम, संपर्क और प्रकाशित नीतियाँ जाँच लें।",
      ),
      seller(
        "कीमत, शिपिंग और गारंटी",
        "राशि, समय, वापसी और भुगतान की शर्तें तभी मान्य हैं जब वे व्यापारी के आधिकारिक चेकआउट पर दिखें।",
      ),
      seller(
        "सामग्री और सूचनाएँ",
        "सामग्री, उपयोग और स्वास्थ्य सूचनाएँ निर्माता के पृष्ठ और लेबल पर पढ़ें। यह पृष्ठ वह जानकारी कॉपी या गढ़ता नहीं।",
      ),
    ],
    productNote:
      "{name} का व्यावसायिक प्रस्ताव देखने के लिए नीचे दिए बटन से आधिकारिक पेशकश पृष्ठ खोलें। खरीद होने पर हमें रेफ़रल कमीशन मिल सकता है — आपके लिए अतिरिक्त लागत नहीं।",
    ctaLabel: "आधिकारिक पेशकश पृष्ठ पर जारी रखें",
  },
  ar: {
    kicker: "صفحة معلومات",
    headline: "كيف تراجع عرض {name} بشفافية",
    intro:
      "هذه الصفحة معلومات مستقلة عن {name}. لسنا الشركة المصنّعة، ولا نعالج المدفوعات، ولا نحل محل نشرة المنتج أو الملصق أو دعم البائع. الهدف هو أن تقرر بهدوء قبل الانتقال إلى موقع العرض.",
    pillarsTitle: "ما يجب تأكيده على الموقع الرسمي",
    pillars: [
      seller(
        "هوية البائع",
        "أكّد الاسم التجاري ووسيلة الاتصال والسياسات المنشورة في وجهة العرض قبل إتمام أي شراء.",
      ),
      seller(
        "السعر والشحن والضمان",
        "المبالغ والمُدد والإرجاع وشروط الدفع تكون صالحة فقط عندما تظهر في الدفع الرسمي للتاجر.",
      ),
      seller(
        "التركيب والتنبيهات",
        "المكوّنات وطريقة الاستخدام وتنبيهات الصحة تُقرأ في صفحة الشركة المصنّعة وعلى الملصق. هذه الصفحة لا تنسخ هذه المعلومات ولا تخترعها.",
      ),
    ],
    productNote:
      "إذا أردت رؤية العرض التجاري لـ {name}، استخدم الزر أدناه لفتح صفحة العرض الرسمية. قد نتلقى عمولة إحالة إذا تم الشراء، دون تكلفة إضافية عليك.",
    ctaLabel: "المتابعة إلى صفحة العرض الرسمية",
  },
  nl: {
    kicker: "Informatiepagina",
    headline: "De aanbieding van {name} transparant beoordelen",
    intro:
      "Deze pagina is onafhankelijke informatie over {name}. Wij zijn niet de fabrikant, we verwerken geen betalingen en we vervangen het productblad, het etiket of de support van de verkoper niet. Het doel is een rustige keuze voordat u naar de aanbiedingssite gaat.",
    pillarsTitle: "Wat u op de officiële site moet controleren",
    pillars: [
      seller(
        "Identiteit van de verkoper",
        "Controleer de handelsnaam, het contact en de gepubliceerde voorwaarden op de aanbiedingsbestemming voordat u een aankoop afrondt.",
      ),
      seller(
        "Prijs, verzending en garantie",
        "Bedragen, termijnen, retouren en betalingsvoorwaarden gelden alleen als ze in de officiële checkout van de handelaar staan.",
      ),
      seller(
        "Samenstelling en meldingen",
        "Ingrediënten, gebruik en gezondheidsmeldingen leest u op de pagina en het etiket van de fabrikant. Deze pagina kopieert of verzint die informatie niet.",
      ),
    ],
    productNote:
      "Wilt u het commerciële aanbod van {name} zien, open dan via de knop de officiële aanbiedingspagina. Bij een aankoop kunnen wij een verwijzingscommissie ontvangen — zonder extra kosten voor u.",
    ctaLabel: "Doorgaan naar de officiële aanbiedingspagina",
  },
  sv: {
    kicker: "Informationssida",
    headline: "Så granskar du erbjudandet för {name} öppet",
    intro:
      "Den här sidan är oberoende information om {name}. Vi är inte tillverkaren, vi tar inte betalt och vi ersätter inte produktblad, etikett eller säljarens support. Målet är att du ska kunna bestämma i lugn och ro innan du går vidare till erbjudandesidan.",
    pillarsTitle: "Det här ska du bekräfta på den officiella sajten",
    pillars: [
      seller(
        "Säljarens identitet",
        "Bekräfta företagsnamn, kontakt och publicerade villkor på erbjudandesidan innan du slutför ett köp.",
      ),
      seller(
        "Pris, frakt och garanti",
        "Belopp, tider, returer och betalningsvillkor gäller bara när de visas i handlarens officiella kassa.",
      ),
      seller(
        "Innehåll och upplysningar",
        "Ingredienser, användning och hälsoupplysningar ska läsas på tillverkarens sida och etikett. Den här sidan varken kopierar eller hittar på den informationen.",
      ),
    ],
    productNote:
      "Om du vill se det kommersiella erbjudandet för {name}, öppna den officiella erbjudandesidan med knappen nedan. Vi kan få en hänvisningsprovision om ett köp sker — utan extra kostnad för dig.",
    ctaLabel: "Fortsätt till den officiella erbjudandesidan",
  },
  no: {
    kicker: "Informasjonsside",
    headline: "Slik vurderer du tilbudet for {name} åpent",
    intro:
      "Denne siden er uavhengig informasjon om {name}. Vi er ikke produsenten, vi behandler ikke betaling, og vi erstatter ikke produktark, etikett eller selgerens støtte. Målet er at du kan bestemme i ro før du går videre til tilbudssiden.",
    pillarsTitle: "Dette bør du bekrefte på det offisielle nettstedet",
    pillars: [
      seller(
        "Selgerens identitet",
        "Bekreft firmanavn, kontakt og publiserte vilkår på tilbudssiden før du fullfører et kjøp.",
      ),
      seller(
        "Pris, frakt og garanti",
        "Beløp, frister, retur og betalingsvilkår gjelder bare når de vises i forhandlerens offisielle kasse.",
      ),
      seller(
        "Innhold og merknader",
        "Ingredienser, bruk og helseopplysninger skal leses på produsentens side og etikett. Denne siden verken kopierer eller finner opp den informasjonen.",
      ),
    ],
    productNote:
      "Hvis du vil se det kommersielle tilbudet for {name}, åpne den offisielle tilbudssiden med knappen under. Vi kan motta en henvisningsprovisjon hvis et kjøp skjer — uten ekstra kostnad for deg.",
    ctaLabel: "Fortsett til den offisielle tilbudssiden",
  },
  da: {
    kicker: "Informationsside",
    headline: "Sådan vurderer du tilbuddet for {name} åbent",
    intro:
      "Denne side er uafhængig information om {name}. Vi er ikke producenten, vi behandler ikke betaling, og vi erstatter ikke produktark, etiket eller sælgerens support. Målet er, at du kan beslutte i ro, før du går videre til tilbudssiden.",
    pillarsTitle: "Det skal du bekræfte på det officielle site",
    pillars: [
      seller(
        "Sælgerens identitet",
        "Bekræft firmanavn, kontakt og offentliggjorte vilkår på tilbudssiden, før du gennemfører et køb.",
      ),
      seller(
        "Pris, fragt og garanti",
        "Beløb, frister, returnering og betalingsvilkår gælder kun, når de står i forhandlerens officielle checkout.",
      ),
      seller(
        "Indhold og oplysninger",
        "Ingredienser, brug og helbredsoplysninger skal læses på producentens side og etiket. Denne side hverken kopierer eller opfinder de oplysninger.",
      ),
    ],
    productNote:
      "Hvis du vil se det kommercielle tilbud for {name}, så åbn den officielle tilbudsside med knappen nedenfor. Vi kan modtage en henvisningsprovision, hvis der sker et køb — uden ekstra omkostning for dig.",
    ctaLabel: "Fortsæt til den officielle tilbudsside",
  },
};
