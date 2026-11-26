/**
 * Termos de copy que as redes de anúncios (Google Ads "Evasão de sistemas" / "Práticas comerciais
 * inaceitáveis") associam a cloaking ou a contornar revisões. O site institucional não os pode publicar.
 */
const AD_POLICY_RISK_RULES: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\bcloak(?:er|ers|ing)?\b/i, label: "cloaker / cloaking" },
  { re: /\bblack\s*\/\s*white\b|\bwhite\s*\/\s*black\b/i, label: "black/white" },
  {
    re: /\b(?:assistente|modo|estrat[ée]gia|p[áa]gina|funil|nicho)\s+black\b|\bblack\s*(?:hat|page)\b/i,
    label: "modo/página black",
  },
  { re: /\bwhite\s*page\b|\bsafe\s*page\b|\bp[áa]gina\s+segura\b/i, label: "white page / página segura" },
  { re: /conting[êe]ncia/i, label: "contingência" },
  {
    re: /\bburlar\b|\bdriblar\b|\bcontornar\s+(?:o\s+|os\s+|a\s+|as\s+)?(?:bloqueio|revis|pol[íi]tica|reprova)/i,
    label: "burlar / contornar bloqueios",
  },
  {
    re: /\b(?:esconder|ocultar|camuflar)\s+(?:o\s+|os\s+|a\s+|as\s+)?(?:link|links|url|urls|oferta|ofertas)\b/i,
    label: "esconder links",
  },
  {
    re: /\b(?:clonar|espelhar)\s+(?:a\s+|uma\s+|as\s+|o\s+)?(?:p[áa]gina|p[áa]ginas|site|sites|landing)\b/i,
    label: "clonar páginas",
  },
  { re: /\bprova\s+de\s+(?:bloqueio|bloqueios|ban|banimento)\b/i, label: "à prova de bloqueio" },
  { re: /\banti[-\s]?ban\b|\bindetect[áa]ve(?:l|is)\b|\bundetectable\b/i, label: "anti-ban / indetectável" },
];

/** Todas as strings de um valor JSON (profundidade arbitrária). */
export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

/** Rótulos dos termos de risco encontrados (sem duplicados, pela ordem das regras). */
export function findAdPolicyRiskTerms(value: unknown): string[] {
  const texts = collectStrings(value);
  return AD_POLICY_RISK_RULES.filter(({ re }) => texts.some((t) => re.test(t))).map(({ label }) => label);
}

export const AD_POLICY_RISK_COPY_MESSAGE =
  "O texto do site contém termos associados a cloaking ou a contornar revisões das redes de anúncios. Use linguagem institucional (ex.: criação de landing pages, otimização de campanhas, rastreamento de métricas).";
