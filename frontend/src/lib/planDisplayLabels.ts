/** Espelha `backend/src/lib/planDisplayLabels.ts` — etiquetas fundidas vindas da API. */
export const DEFAULT_PLAN_DISPLAY_LABELS: Record<string, string> = {
  price_symbol: "R$",
  price_currency: "BRL",
  locale: "pt-BR",
  price_free: "Grátis",
  suffix_monthly: "/mês",
  suffix_annual: "/ano",
  suffix_quarterly: "/trimestre",
  coverage_title: "Cobertura do plano",
  label_presell_pages: "Páginas presell",
  label_clicks: "Cliques / tracking (mês)",
  label_branding: "Marca no rodapé",
  sub_presell_pages: "simultâneas na sua conta",
  sub_clicks: "quota mensal partilhada na conta",
  branding_yes: "Clickora visível",
  branding_no: "Sem marca Clickora",
  unlimited_pages: "Ilimitadas",
  unlimited_clicks: "Ilimitados",
  includes_title: "Também inclui",
  badge_popular: "Mais popular",
  badge_current: "Atual",
  cta_current: "Plano atual",
  cta_free: "Começar grátis",
  cta_upgrade: "Fazer upgrade",
  current_plan_banner_title: "Plano atual",
  section_your_plan_title: "Seu plano atual",
  label_plan_col: "Plano",
  label_pages_col: "Páginas presell",
  label_clicks_col: "Cliques/mês",
};

export function mergeWithDefaultLabels(merged: Record<string, string> | undefined | null): Record<string, string> {
  return { ...DEFAULT_PLAN_DISPLAY_LABELS, ...(merged ?? {}) };
}

export function formatPlanPrice(cents: number, labels: Record<string, string>): string {
  if (cents === 0) return labels.price_free ?? DEFAULT_PLAN_DISPLAY_LABELS.price_free;
  const cur = labels.price_currency || DEFAULT_PLAN_DISPLAY_LABELS.price_currency;
  const locale = labels.locale || DEFAULT_PLAN_DISPLAY_LABELS.locale;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: cur }).format(cents / 100);
  } catch {
    const sym = labels.price_symbol ?? DEFAULT_PLAN_DISPLAY_LABELS.price_symbol;
    return `${sym} ${(cents / 100).toFixed(2).replace(".", ",")}`;
  }
}

export function getPlanPriceSuffix(planType: string, labels: Record<string, string>): string {
  switch (planType) {
    case "monthly":
      return labels.suffix_monthly ?? DEFAULT_PLAN_DISPLAY_LABELS.suffix_monthly;
    case "annual":
      return labels.suffix_annual ?? DEFAULT_PLAN_DISPLAY_LABELS.suffix_annual;
    case "quarterly":
      return labels.suffix_quarterly ?? DEFAULT_PLAN_DISPLAY_LABELS.suffix_quarterly;
    default:
      return "";
  }
}

/** Ordem dos campos no editor admin (landing /planos). */
export const PLAN_LABEL_FORM_FIELDS: { key: string; title: string }[] = [
  { key: "price_symbol", title: "Símbolo (ex.: R$, €)" },
  { key: "price_currency", title: "Código ISO da moeda (BRL, EUR, USD…)" },
  { key: "locale", title: "Locale para formatação (pt-BR, pt-PT…)" },
  { key: "price_free", title: "Texto quando o preço é zero" },
  { key: "suffix_monthly", title: "Sufixo mensal (ex.: /mês)" },
  { key: "suffix_annual", title: "Sufixo anual (ex.: /ano)" },
  { key: "suffix_quarterly", title: "Sufixo trimestral" },
  { key: "coverage_title", title: "Título da secção «Cobertura do plano»" },
  { key: "label_presell_pages", title: "Etiqueta «Páginas presell»" },
  { key: "label_clicks", title: "Etiqueta «Cliques / tracking»" },
  { key: "label_branding", title: "Etiqueta «Marca no rodapé»" },
  { key: "sub_presell_pages", title: "Subtexto presells" },
  { key: "sub_clicks", title: "Subtexto cliques" },
  { key: "branding_yes", title: "Texto com branding" },
  { key: "branding_no", title: "Texto sem branding" },
  { key: "unlimited_pages", title: "Ilimitadas (presells)" },
  { key: "unlimited_clicks", title: "Ilimitados (cliques)" },
  { key: "includes_title", title: "Título «Também inclui»" },
  { key: "badge_popular", title: "Selo «Mais popular»" },
  { key: "badge_current", title: "Selo «Atual»" },
  { key: "cta_current", title: "Botão «Plano atual»" },
  { key: "cta_free", title: "Botão «Começar grátis»" },
  { key: "cta_upgrade", title: "Botão «Fazer upgrade»" },
  { key: "current_plan_banner_title", title: "Título do bloco «Plano atual» (topo)" },
  { key: "section_your_plan_title", title: "Título «Seu plano atual» (secção inferior)" },
  { key: "label_plan_col", title: "Coluna «Plano»" },
  { key: "label_pages_col", title: "Coluna «Páginas presell»" },
  { key: "label_clicks_col", title: "Coluna «Cliques/mês»" },
];
