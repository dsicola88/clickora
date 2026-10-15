import type { PresellLocaleKey } from "./presellUiStrings.types";
import { normalizePresellLocale } from "./presellUiStrings";

export type PortalChromeCopy = {
  independentPage: string;
  rights: string;
  affiliateTitle: string;
  affiliateBody: string;
  disclaimer: string;
  operator: string;
  document: string;
  contact: string;
  platformContact: string;
  completeOperator: string;
  policies: string;
  medical: string;
};

const PORTAL: Record<PresellLocaleKey, PortalChromeCopy> = {
  en: {
    independentPage: "Independent informational page",
    rights: "All rights reserved.",
    affiliateTitle: "Affiliate notice:",
    affiliateBody:
      "This site works independently as an informational page. We are not the manufacturer or the payment processor. If you follow the links and a purchase is made on the offer site, we may earn a referral commission, at no extra cost to you.",
    disclaimer:
      "Disclaimer: this content is informational and does not replace medical, nutritional, or legal advice. Confirm ingredients, notices, and terms only on the official product site and label.",
    operator: "Operator:",
    document: "Document:",
    contact: "Contact:",
    platformContact: "Platform contact:",
    completeOperator: "Add the operator name and document in the presell settings before you advertise.",
    policies: "Policies",
    medical: "Medical disclaimer",
  },
  es: {
    independentPage: "Página informativa independiente",
    rights: "Todos los derechos reservados.",
    affiliateTitle: "Aviso de afiliado:",
    affiliateBody:
      "Este sitio funciona de forma independiente como página informativa. No somos el fabricante ni el procesador de pago. Si sigues los enlaces y se realiza una compra en el sitio de la oferta, podemos recibir una comisión de referencia, sin coste extra para ti.",
    disclaimer:
      "Aviso: el contenido es informativo y no sustituye asesoramiento médico, nutricional o jurídico. Confirma composición, avisos y condiciones solo en el sitio y la etiqueta oficiales del producto.",
    operator: "Operador:",
    document: "Documento:",
    contact: "Contacto:",
    platformContact: "Contacto de la plataforma:",
    completeOperator: "Completa el nombre y el documento del operador en los ajustes de la presell antes de anunciar.",
    policies: "Políticas",
    medical: "Aviso médico",
  },
  "pt-BR": {
    independentPage: "Página informativa independente",
    rights: "Todos os direitos reservados.",
    affiliateTitle: "Aviso de Afiliado:",
    affiliateBody:
      "Este site atua de forma independente como um portal de conteúdo informativo. Não somos o fabricante nem o processador de pagamento. Ao clicar nos links e visitar o site da oferta, poderemos receber uma comissão por indicação caso uma compra seja efetuada, sem custo extra para si.",
    disclaimer:
      "Aviso de isenção: o conteúdo é informativo e não substitui aconselhamento médico, nutricional ou jurídico. Confirme composição, avisos e condições apenas no site e no rótulo oficiais do produto.",
    operator: "Operador:",
    document: "Documento:",
    contact: "Contacto:",
    platformContact: "Contacto da plataforma:",
    completeOperator: "Complete o nome e documento do operador nas definições da presell antes de anunciar.",
    policies: "Políticas",
    medical: "Aviso de isenção médica",
  },
  de: {
    independentPage: "Unabhängige Informationsseite",
    rights: "Alle Rechte vorbehalten.",
    affiliateTitle: "Affiliate-Hinweis:",
    affiliateBody:
      "Diese Website arbeitet unabhängig als Informationsseite. Wir sind nicht der Hersteller und nicht der Zahlungsabwickler. Wenn Sie den Links folgen und auf der Angebotsseite ein Kauf erfolgt, können wir eine Vermittlungsprovision erhalten — ohne Mehrkosten für Sie.",
    disclaimer:
      "Hinweis: Der Inhalt ist informativ und ersetzt keine medizinische, ernährungsbezogene oder rechtliche Beratung. Zusammensetzung, Hinweise und Bedingungen nur auf der offiziellen Produktseite und dem Etikett prüfen.",
    operator: "Betreiber:",
    document: "Dokument:",
    contact: "Kontakt:",
    platformContact: "Kontakt der Plattform:",
    completeOperator: "Tragen Sie Name und Dokument des Betreibers in den Presell-Einstellungen ein, bevor Sie werben.",
    policies: "Richtlinien",
    medical: "Medizinischer Hinweis",
  },
  fr: {
    independentPage: "Page d’information indépendante",
    rights: "Tous droits réservés.",
    affiliateTitle: "Avis d’affiliation :",
    affiliateBody:
      "Ce site agit de façon indépendante comme page d’information. Nous ne sommes ni le fabricant ni le prestataire de paiement. Si vous suivez les liens et qu’un achat est effectué sur le site de l’offre, nous pouvons recevoir une commission d’indication, sans frais supplémentaires pour vous.",
    disclaimer:
      "Avertissement : le contenu est informatif et ne remplace pas un avis médical, nutritionnel ou juridique. Confirmez la composition, les mentions et les conditions uniquement sur le site et l’étiquette officiels du produit.",
    operator: "Opérateur :",
    document: "Document :",
    contact: "Contact :",
    platformContact: "Contact de la plateforme :",
    completeOperator: "Renseignez le nom et le document de l’opérateur dans les réglages de la presell avant de diffuser.",
    policies: "Politiques",
    medical: "Avertissement médical",
  },
  it: {
    independentPage: "Pagina informativa indipendente",
    rights: "Tutti i diritti riservati.",
    affiliateTitle: "Avviso di affiliazione:",
    affiliateBody:
      "Questo sito opera in modo indipendente come pagina informativa. Non siamo il produttore né il gestore dei pagamenti. Se segui i link e viene effettuato un acquisto sul sito dell’offerta, possiamo ricevere una commissione di segnalazione, senza costi extra per te.",
    disclaimer:
      "Avviso: il contenuto è informativo e non sostituisce un parere medico, nutrizionale o legale. Conferma composizione, avvertenze e condizioni solo sul sito e sull’etichetta ufficiali del prodotto.",
    operator: "Operatore:",
    document: "Documento:",
    contact: "Contatto:",
    platformContact: "Contatto della piattaforma:",
    completeOperator: "Completa nome e documento dell’operatore nelle impostazioni della presell prima di fare pubblicità.",
    policies: "Politiche",
    medical: "Avviso medico",
  },
  pl: {
    independentPage: "Niezależna strona informacyjna",
    rights: "Wszelkie prawa zastrzeżone.",
    affiliateTitle: "Informacja afiliacyjna:",
    affiliateBody:
      "Ta witryna działa niezależnie jako strona informacyjna. Nie jesteśmy producentem ani operatorem płatności. Jeśli przejdziesz linkami i na stronie oferty dojdzie do zakupu, możemy otrzymać prowizję za polecenie, bez dodatkowych kosztów dla Ciebie.",
    disclaimer:
      "Zastrzeżenie: treść ma charakter informacyjny i nie zastępuje porady medycznej, żywieniowej ani prawnej. Skład, ostrzeżenia i warunki potwierdź tylko na oficjalnej stronie i etykiecie produktu.",
    operator: "Operator:",
    document: "Dokument:",
    contact: "Kontakt:",
    platformContact: "Kontakt platformy:",
    completeOperator: "Uzupełnij nazwę i dokument operatora w ustawieniach presell przed emisją reklamy.",
    policies: "Zasady",
    medical: "Zastrzeżenie medyczne",
  },
  tr: {
    independentPage: "Bağımsız bilgi sayfası",
    rights: "Tüm hakları saklıdır.",
    affiliateTitle: "Ortaklık bildirimi:",
    affiliateBody:
      "Bu site bağımsız bir bilgi sayfası olarak çalışır. Üretici veya ödeme kuruluşu değiliz. Bağlantıları izleyip teklif sitesinde bir satın alma olursa, size ek ücret olmadan yönlendirme komisyonu alabiliriz.",
    disclaimer:
      "Uyarı: içerik bilgilendirme amaçlıdır ve tıbbi, beslenme veya hukuki danışmanlığın yerine geçmez. İçerik, uyarılar ve koşulları yalnızca ürünün resmi sitesinde ve etiketinde doğrulayın.",
    operator: "İşleten:",
    document: "Belge:",
    contact: "İletişim:",
    platformContact: "Platform iletişimi:",
    completeOperator: "Reklam vermeden önce presell ayarlarına işletenin adını ve belgesini ekleyin.",
    policies: "Politikalar",
    medical: "Tıbbi uyarı",
  },
  hi: {
    independentPage: "स्वतंत्र सूचना पृष्ठ",
    rights: "सर्वाधिकार सुरक्षित।",
    affiliateTitle: "एफिलिएट सूचना:",
    affiliateBody:
      "यह साइट स्वतंत्र सूचना पृष्ठ के रूप में काम करती है। हम निर्माता या भुगतान संसाधक नहीं हैं। यदि आप लिंक पर जाकर पेशकश साइट पर खरीद करते हैं, तो हमें रेफ़रल कमीशन मिल सकता है — आपके लिए अतिरिक्त लागत नहीं।",
    disclaimer:
      "अस्वीकरण: यह सामग्री सूचनात्मक है और चिकित्सकीय, पोषण या कानूनी सलाह की जगह नहीं लेती। सामग्री, सूचनाएँ और शर्तें केवल उत्पाद की आधिकारिक साइट और लेबल पर जाँचें।",
    operator: "संचालक:",
    document: "दस्तावेज़:",
    contact: "संपर्क:",
    platformContact: "प्लेटफ़ॉर्म संपर्क:",
    completeOperator: "विज्ञापन से पहले प्रेसेल सेटिंग में संचालक का नाम और दस्तावेज़ जोड़ें।",
    policies: "नीतियाँ",
    medical: "चिकित्सा अस्वीकरण",
  },
  ar: {
    independentPage: "صفحة معلومات مستقلة",
    rights: "جميع الحقوق محفوظة.",
    affiliateTitle: "إشعار الشراكة:",
    affiliateBody:
      "يعمل هذا الموقع بشكل مستقل كصفحة معلومات. لسنا الشركة المصنّعة ولا معالج الدفع. إذا تابعت الروابط وتم شراء على موقع العرض، فقد نتلقى عمولة إحالة دون تكلفة إضافية عليك.",
    disclaimer:
      "تنبيه: المحتوى معلوماتي ولا يغني عن استشارة طبية أو تغذوية أو قانونية. أكّد المكوّنات والتنبيهات والشروط فقط على الموقع والملصق الرسميين للمنتج.",
    operator: "المشغّل:",
    document: "الوثيقة:",
    contact: "التواصل:",
    platformContact: "تواصل المنصة:",
    completeOperator: "أضف اسم المشغّل ووثيقته في إعدادات الصفحة قبل الإعلان.",
    policies: "السياسات",
    medical: "إخلاء مسؤولية طبية",
  },
  nl: {
    independentPage: "Onafhankelijke informatiepagina",
    rights: "Alle rechten voorbehouden.",
    affiliateTitle: "Affiliate-melding:",
    affiliateBody:
      "Deze site werkt onafhankelijk als informatiepagina. Wij zijn niet de fabrikant en niet de betalingsverwerker. Als u de links volgt en er een aankoop op de aanbiedingssite plaatsvindt, kunnen wij een verwijzingscommissie ontvangen, zonder extra kosten voor u.",
    disclaimer:
      "Disclaimer: de inhoud is informatief en vervangt geen medisch, voedings- of juridisch advies. Bevestig ingrediënten, meldingen en voorwaarden alleen op de officiële productpagina en het etiket.",
    operator: "Exploitant:",
    document: "Document:",
    contact: "Contact:",
    platformContact: "Contact van het platform:",
    completeOperator: "Vul de naam en het document van de exploitant in bij de presell-instellingen voordat u adverteert.",
    policies: "Beleid",
    medical: "Medische disclaimer",
  },
  sv: {
    independentPage: "Oberoende informationssida",
    rights: "Alla rättigheter förbehållna.",
    affiliateTitle: "Affiliate-meddelande:",
    affiliateBody:
      "Den här webbplatsen fungerar oberoende som en informationssida. Vi är inte tillverkaren och inte betalningsförmedlaren. Om du följer länkarna och ett köp sker på erbjudandesidan kan vi få en hänvisningsprovision, utan extra kostnad för dig.",
    disclaimer:
      "Ansvarsfriskrivning: innehållet är informativt och ersätter inte medicinsk, näringsmässig eller juridisk rådgivning. Bekräfta innehåll, upplysningar och villkor bara på produktens officiella sida och etikett.",
    operator: "Operatör:",
    document: "Dokument:",
    contact: "Kontakt:",
    platformContact: "Plattformens kontakt:",
    completeOperator: "Fyll i operatörens namn och dokument i presell-inställningarna innan du annonserar.",
    policies: "Policyer",
    medical: "Medicinsk friskrivning",
  },
  no: {
    independentPage: "Uavhengig informasjonsside",
    rights: "Alle rettigheter forbeholdt.",
    affiliateTitle: "Affiliate-merknad:",
    affiliateBody:
      "Dette nettstedet fungerer uavhengig som en informasjonsside. Vi er ikke produsenten og ikke betalingsbehandleren. Hvis du følger lenkene og et kjøp skjer på tilbudssiden, kan vi motta en henvisningsprovisjon, uten ekstra kostnad for deg.",
    disclaimer:
      "Ansvarsfraskrivelse: innholdet er informativt og erstatter ikke medisinsk, ernæringsmessig eller juridisk råd. Bekreft innhold, merknader og vilkår bare på produktets offisielle side og etikett.",
    operator: "Operatør:",
    document: "Dokument:",
    contact: "Kontakt:",
    platformContact: "Plattformens kontakt:",
    completeOperator: "Fyll inn operatørens navn og dokument i presell-innstillingene før du annonserer.",
    policies: "Retningslinjer",
    medical: "Medisinsk ansvarsfraskrivelse",
  },
  da: {
    independentPage: "Uafhængig informationsside",
    rights: "Alle rettigheder forbeholdes.",
    affiliateTitle: "Affiliate-meddelelse:",
    affiliateBody:
      "Dette site fungerer uafhængigt som en informationsside. Vi er ikke producenten og ikke betalingsbehandleren. Hvis du følger linkene, og der sker et køb på tilbudssiden, kan vi modtage en henvisningsprovision uden ekstra omkostning for dig.",
    disclaimer:
      "Ansvarsfraskrivelse: indholdet er informativt og erstatter ikke medicinsk, ernæringsmæssig eller juridisk rådgivning. Bekræft indhold, oplysninger og vilkår kun på produktets officielle side og etiket.",
    operator: "Operatør:",
    document: "Dokument:",
    contact: "Kontakt:",
    platformContact: "Platformens kontakt:",
    completeOperator: "Udfyld operatørens navn og dokument i presell-indstillingerne, før du annoncerer.",
    policies: "Politikker",
    medical: "Medicinsk ansvarsfraskrivelse",
  },
};

export function getPortalChromeCopy(language: string | undefined): PortalChromeCopy {
  return PORTAL[normalizePresellLocale(language)];
}
