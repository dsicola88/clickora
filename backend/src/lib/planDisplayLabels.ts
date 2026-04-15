/** Etiquetas da página de planos (merge com a BD). Chaves em snake_case estáveis na API. */
export const DEFAULT_PLAN_DISPLAY_LABELS: Record<string, string> = {
  price_symbol: "$",
  price_currency: "USD",
  locale: "en-US",
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
  annual_pitch_equiv:
    "≈ {{equiv}}/mês em média ao pagar o ano de uma vez — faturação anual única.",
  annual_pitch_savings:
    "Poupe {{save}} em relação a 12 meses no {{monthly_name}} ({{pct}}% de desconto).",
  annual_pitch_reference:
    "Referência: 12× {{monthly_name}} = {{compare_yearly}}/ano a preço mensal.",
  badge_best_value: "Melhor valor",
};

const MAX_LEN = 500;

export function mergePlanDisplayLabels(stored: unknown): Record<string, string> {
  const out = { ...DEFAULT_PLAN_DISPLAY_LABELS };
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return out;
  for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length > 80) continue;
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length > MAX_LEN) continue;
    out[k] = t;
  }
  return out;
}

/** PATCH parcial: sobrepõe etiquetas já fundidas (valores guardados na BD podem ser o objeto fundido completo). */
export function mergePlanDisplayLabelPatch(
  currentMerged: Record<string, string>,
  patch: Record<string, string>,
): Record<string, string> {
  const out = { ...currentMerged };
  for (const [k, v] of Object.entries(patch)) {
    if (typeof k !== "string" || k.length > 80) continue;
    const t = typeof v === "string" ? v.trim() : "";
    if (t.length > MAX_LEN) continue;
    out[k] = t;
  }
  return out;
}
