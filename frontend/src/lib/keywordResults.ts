import type { KeywordIntent, KeywordItem, KeywordResearch, NegativeGroup } from "@/services/keywordResearchService";

export const KEYWORD_INTENT_FILTERS: { id: "ALL" | KeywordIntent; label: string }[] = [
  { id: "ALL", label: "Todas" },
  { id: "BUY", label: "Compra" },
  { id: "COMMERCIAL", label: "Comercial" },
  { id: "INFORMATIONAL", label: "Informativa" },
  { id: "COMPARISON", label: "Comparação" },
  { id: "BRAND", label: "Marca" },
  { id: "NEGATIVE", label: "Sugestões de negativas" },
];

export const KEYWORD_INTENT_SECTIONS: { intent: KeywordIntent; title: string }[] = [
  { intent: "BUY", title: "🔥 Compra" },
  { intent: "COMMERCIAL", title: "💰 Comercial" },
  { intent: "INFORMATIONAL", title: "📚 Informativa" },
  { intent: "COMPARISON", title: "⚖️ Comparação" },
  { intent: "BRAND", title: "🏷️ Marca" },
  { intent: "NEGATIVE", title: "🚫 Sugestões de negativas" },
];

export const KEYWORD_FUNNEL_SECTIONS: { id: "BOTTOM" | "MIDDLE" | "TOP"; title: string; hint: string }[] = [
  { id: "BOTTOM", title: "Fundo de funil", hint: "Compra e marca. Quem está pronto a escolher a página." },
  { id: "MIDDLE", title: "Meio de funil", hint: "Comparação e pesquisa comercial. Quem ainda avalia." },
  { id: "TOP", title: "Topo de funil", hint: "Pesquisa informativa. Quem ainda está a perceber o tema." },
];

export function keywordFunnel(item: KeywordItem): "TOP" | "MIDDLE" | "BOTTOM" | null {
  if (item.funnel === "TOP" || item.funnel === "MIDDLE" || item.funnel === "BOTTOM") return item.funnel;
  if (item.intent === "BUY" || item.intent === "BRAND") return "BOTTOM";
  if (item.intent === "COMMERCIAL" || item.intent === "COMPARISON") return "MIDDLE";
  if (item.intent === "INFORMATIONAL") return "TOP";
  return null;
}

export function funnelLabel(item: KeywordItem): string {
  const funnel = keywordFunnel(item);
  if (funnel === "BOTTOM") return "Fundo de funil";
  if (funnel === "MIDDLE") return "Meio de funil";
  if (funnel === "TOP") return "Topo de funil";
  return "Fora do funil";
}

export const NEGATIVE_GROUP_ORDER: NegativeGroup[] = ["JOBS", "FREE", "ACCOUNT", "OTHER"];

export function negativeGroupLabel(group: NegativeGroup): string {
  if (group === "JOBS") return "Emprego";
  if (group === "FREE") return "Grátis e downloads";
  if (group === "ACCOUNT") return "Conta e login";
  return "Outras — rever";
}

export function groupNegativeKeywords(items: KeywordItem[]): { group: NegativeGroup; items: KeywordItem[] }[] {
  const buckets = new Map<NegativeGroup, KeywordItem[]>();
  for (const item of items) {
    const group = item.negativeGroup && NEGATIVE_GROUP_ORDER.includes(item.negativeGroup) ? item.negativeGroup : "OTHER";
    const list = buckets.get(group) ?? [];
    list.push(item);
    buckets.set(group, list);
  }
  return NEGATIVE_GROUP_ORDER.filter((group) => buckets.has(group)).map((group) => ({
    group,
    items: buckets.get(group) ?? [],
  }));
}

export function setKeywordSelection(selected: Set<string>, keywords: string[], select: boolean): Set<string> {
  const next = new Set(selected);
  for (const keyword of keywords) {
    if (select) next.add(keyword);
    else next.delete(keyword);
  }
  return next;
}

export function relevanceLabel(r: KeywordItem["relevance"]): string {
  if (r === "HIGH") return "Alta";
  if (r === "LOW") return "Baixa";
  return "Média";
}

export function filterKeywords(
  items: KeywordItem[],
  query: string,
  intent: "ALL" | KeywordIntent,
): KeywordItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((k) => {
    if (intent !== "ALL" && k.intent !== intent) return false;
    if (q && !k.keyword.includes(q)) return false;
    return true;
  });
}

export function toggleKeywordSelection(selected: Set<string>, keyword: string): Set<string> {
  const next = new Set(selected);
  if (next.has(keyword)) next.delete(keyword);
  else next.add(keyword);
  return next;
}

export function copyKeywordsText(items: KeywordItem[]): string {
  return items.map((k) => k.keyword).join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function keywordsToCsv(
  items: KeywordItem[],
  meta: Pick<KeywordResearch, "language" | "market" | "product">,
): string {
  const header = "keyword,intent,funnel,relevance,theme,match_types,natural,negative_suggestion,negative_group,language,market,product";
  const rows = items.map((k) =>
    [
      csvEscape(k.keyword),
      csvEscape(k.intent),
      csvEscape(keywordFunnel(k) ?? ""),
      csvEscape(k.relevance),
      csvEscape(k.theme ?? ""),
      csvEscape((k.matchTypes ?? []).join("|")),
      k.natural === false ? "false" : "true",
      k.negativeSuggestion ? "true" : "false",
      csvEscape(k.negativeGroup ?? ""),
      csvEscape(meta.language),
      csvEscape(meta.market),
      csvEscape(meta.product),
    ].join(","),
  );
  return `\uFEFF${[header, ...rows].join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatResearchDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
