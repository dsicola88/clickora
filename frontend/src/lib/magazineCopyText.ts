import type { AdBundle, KeywordItem } from "@/services/keywordResearchService";

/** Texto no estilo do PDF MAG (títulos, descrições, destaques, snippet, sitelinks, promoção). */
export function magazineCopyText(product: string, bundle: AdBundle, keywords?: KeywordItem[]): string {
  const sitelinkBlock = bundle.sitelinks
    .map((s) => {
      const parts = [s.text, s.description1, s.description2].filter(Boolean);
      return parts.join("\n");
    })
    .filter(Boolean);

  const snippetBlock = bundle.snippet
    ? [bundle.snippet.header, ...bundle.snippet.values].join("\n")
    : "";

  const promoBlock = bundle.promotion
    ? [bundle.promotion.value, bundle.promotion.item, bundle.promotion.terms].filter(Boolean).join(" · ")
    : "";

  const positives = keywords?.filter((k) => k.intent !== "NEGATIVE").map((k) => k.keyword) ?? [];
  const negatives = keywords?.filter((k) => k.intent === "NEGATIVE").map((k) => k.keyword) ?? [];

  return [
    product,
    "",
    ...(positives.length
      ? ["PALAVRAS-CHAVE:", ...positives, ""]
      : []),
    ...(negatives.length
      ? ["NEGATIVAS:", ...negatives, ""]
      : []),
    "TÍTULOS:",
    ...bundle.headlines.map((h) => h.text),
    "",
    "DESCRIÇÕES:",
    ...bundle.descriptions.map((d) => d.text),
    "",
    "FRASE DE DESTAQUE:",
    ...bundle.callouts.map((c) => c.text),
    "",
    "SNIPPET ESTRUTURADO:",
    snippetBlock || "—",
    "",
    "SITELINK:",
    ...(sitelinkBlock.length ? sitelinkBlock : ["—"]),
    "",
    "PROMOÇÃO:",
    promoBlock || "—",
  ].join("\n");
}
