/**
 * Gate «Segmentação»: modal de escolha com dois destinos (ex. Review vs Página oficial).
 * Destinos vazios caem no hoplink da oferta; `co_seg` identifica o braço no tracking.
 */

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

const COPY: Record<string, { title: string; review: string; official: string; close: string }> = {
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
  pt: {
    title: "O que gostaria de ver primeiro?",
    review: "Ver análise",
    official: "Página oficial",
    close: "Fechar",
  },
};

function localeBucket(raw: string | undefined): keyof typeof COPY {
  const r = (raw || "en").trim().toLowerCase().replace(/_/g, "-");
  if (r.startsWith("pt")) return r.includes("pt-pt") || r === "pt" ? "pt" : "pt-BR";
  if (r.startsWith("es")) return "es";
  return "en";
}

/** Lê settings da presell + defaults profissionais por idioma. */
export function resolveSegmentationCopy(
  settings: Record<string, unknown> | null | undefined,
  language?: string,
): ResolvedSegmentationCopy {
  const s = settings && typeof settings === "object" ? settings : {};
  const L = COPY[localeBucket(language)] ?? COPY.en;
  const allowRaw = s.segmentationAllowClose ?? s.segmentation_allow_close;
  return {
    title: str(s.segmentationTitle ?? s.segmentation_title) || L.title,
    reviewLabel: str(s.segmentationReviewLabel ?? s.segmentation_review_label) || L.review,
    officialLabel: str(s.segmentationOfficialLabel ?? s.segmentation_official_label) || L.official,
    closeLabel: str(s.segmentationCloseLabel ?? s.segmentation_close_label) || L.close,
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
