/**
 * Gate «Segmentação»: modal de escolha com dois destinos (ex. Review vs Página oficial).
 * Destinos vazios caem no hoplink da oferta; `co_seg` identifica o braço no tracking.
 */

import { getPresellUiStrings, normalizePresellLocale, type PresellLocaleKey } from "@/lib/presellUiStrings";

export type SegmentationChoiceId = "review" | "official";

export type ResolvedSegmentationCopy = {
  title: string;
  reviewLabel: string;
  officialLabel: string;
  closeLabel: string;
  allowClose: boolean;
  /** Destino absoluto http(s) preferido para Review (vazio = hoplink). */
  reviewUrl: string;
  /** Destino absoluto http(s) preferido para Official (vazio = hoplink). */
  officialUrl: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function httpUrl(v: string): string {
  const u = v.trim();
  if (!u || u === "#") return "";
  if (!/^https?:\/\//i.test(u)) return "";
  return u;
}

const SEGMENTATION_COPY: Record<
  PresellLocaleKey,
  { title: string; review: string; official: string; close: string }
> = {
  en: {
    title: "What would you like to see first?",
    review: "View Review",
    official: "Official Page",
    close: "Close",
  },
  es: {
    title: "¿Qué le gustaría ver primero?",
    review: "Ver reseña",
    official: "Página oficial",
    close: "Cerrar",
  },
  "pt-BR": {
    title: "O que gostaria de ver primeiro?",
    review: "Ver análise",
    official: "Página oficial",
    close: "Fechar",
  },
  de: {
    title: "Was möchten Sie zuerst sehen?",
    review: "Bewertung ansehen",
    official: "Offizielle Seite",
    close: "Schließen",
  },
  fr: {
    title: "Que souhaitez-vous voir en premier ?",
    review: "Voir l’avis",
    official: "Page officielle",
    close: "Fermer",
  },
  it: {
    title: "Cosa vorresti vedere per primo?",
    review: "Vedi recensione",
    official: "Pagina ufficiale",
    close: "Chiudi",
  },
  pl: {
    title: "Co chcesz zobaczyć najpierw?",
    review: "Zobacz recenzję",
    official: "Oficjalna strona",
    close: "Zamknij",
  },
  tr: {
    title: "Önce ne görmek istersiniz?",
    review: "İncelemeyi gör",
    official: "Resmî sayfa",
    close: "Kapat",
  },
  hi: {
    title: "आप पहले क्या देखना चाहेंगे?",
    review: "समीक्षा देखें",
    official: "आधिकारिक पृष्ठ",
    close: "बंद करें",
  },
  ar: {
    title: "ماذا تريد أن ترى أولاً؟",
    review: "عرض المراجعة",
    official: "الصفحة الرسمية",
    close: "إغلاق",
  },
  nl: {
    title: "Wat wilt u eerst zien?",
    review: "Review bekijken",
    official: "Officiële pagina",
    close: "Sluiten",
  },
  sv: {
    title: "Vad vill du se först?",
    review: "Visa recension",
    official: "Officiell sida",
    close: "Stäng",
  },
  no: {
    title: "Hva vil du se først?",
    review: "Se anmeldelse",
    official: "Offisiell side",
    close: "Lukk",
  },
  da: {
    title: "Hvad vil du se først?",
    review: "Se anmeldelse",
    official: "Officiel side",
    close: "Luk",
  },
};

/** Lê settings da presell + defaults profissionais por idioma. */
export function resolveSegmentationCopy(
  settings: Record<string, unknown> | null | undefined,
  language?: string,
): ResolvedSegmentationCopy {
  const s = settings && typeof settings === "object" ? settings : {};
  const locale = normalizePresellLocale(language);
  const L = SEGMENTATION_COPY[locale] ?? SEGMENTATION_COPY.en;
  const ui = getPresellUiStrings(locale);
  const allowRaw = s.segmentationAllowClose ?? s.segmentation_allow_close;
  return {
    title: str(s.segmentationTitle ?? s.segmentation_title) || L.title,
    reviewLabel: str(s.segmentationReviewLabel ?? s.segmentation_review_label) || L.review,
    officialLabel: str(s.segmentationOfficialLabel ?? s.segmentation_official_label) || L.official,
    closeLabel: str(s.segmentationCloseLabel ?? s.segmentation_close_label) || L.close || ui.cookieClose,
    allowClose: !(allowRaw === false || allowRaw === 0 || allowRaw === "false" || allowRaw === "0"),
    reviewUrl: httpUrl(str(s.segmentationReviewUrl ?? s.segmentation_review_url)),
    officialUrl: httpUrl(str(s.segmentationOfferUrl ?? s.segmentation_offer_url ?? s.segmentationOfficialUrl)),
  };
}

/** Destino final (hoplink ou URL custom) + tag de braço. */
export function resolveSegmentationDestination(
  choice: SegmentationChoiceId,
  copy: ResolvedSegmentationCopy,
  affiliateLink: string,
): { dest: string; segParam: string } {
  const fallback = httpUrl(affiliateLink);
  if (choice === "review") {
    return { dest: copy.reviewUrl || fallback, segParam: "review" };
  }
  return { dest: copy.officialUrl || fallback, segParam: "official" };
}

export function isSegmentationPresellType(type: string | null | undefined): boolean {
  return (type || "").trim().toLowerCase() === "segmentacao";
}
