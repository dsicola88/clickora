/**
 * Análise estática do código personalizado da presell (`headerCode` / `bodyCode` / `footerCode`).
 *
 * É o vector mais comum de «site comprometido» em landers de afiliado: snippets colados que
 * redirecionam o visitante, abrem popunders, minam cripto, carregam iframes invisíveis ou vêm
 * ofuscados. Só diagnostica — nunca altera o HTML servido.
 */

export type CustomCodeRiskReport = {
  /** Comportamentos que tiram o visitante da página ou o exploram (redirect, popunder, miner, iframe oculto). */
  hijack: string[];
  /** Sinais de código ofuscado (eval, atob, fromCharCode, …) — comuns em injeções maliciosas. */
  obfuscation: string[];
};

const HIJACK_PATTERNS: Array<{ label: string; re: RegExp }> = [
  {
    label: "redirect via location =",
    re: /(?<!(?:var|let|const)\s+)(?<![\w$])(?:(?:window|document|top|self|parent)\.)?location(?:\.href)?\s*=(?!=)/i,
  },
  { label: "redirect via location.replace/assign", re: /\blocation\.(?:replace|assign)\s*\(/i },
  { label: "meta refresh", re: /http-equiv\s*=\s*["']?refresh/i },
  { label: "window.open (popup/popunder)", re: /\bwindow\.open\s*\(/i },
  { label: "sequestro do botão voltar (popstate)", re: /addEventListener\s*\(\s*["']popstate["']|\bonpopstate\s*=/i },
  { label: "minerador de cripto", re: /coinhive|coin-hive|cryptonight|crypto-loot|coinimp|webminer|\bminero\b/i },
];

const OBFUSCATION_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "eval()", re: /\beval\s*\(/ },
  { label: "new Function()", re: /\bnew\s+Function\s*\(/ },
  { label: "atob()", re: /\batob\s*\(/ },
  { label: "String.fromCharCode", re: /String\.fromCharCode/ },
  { label: "unescape()", re: /\bunescape\s*\(/ },
  { label: "document.write()", re: /\bdocument\.write(?:ln)?\s*\(/ },
  { label: "sequência longa de escapes hex/unicode", re: /(?:\\x[0-9a-f]{2}|\\u[0-9a-f]{4}){12,}/i },
];

/** O noscript oficial do Google Tag Manager usa iframe 0×0 oculto — legítimo. */
const ALLOWED_HIDDEN_IFRAME_SRC = /^https:\/\/www\.googletagmanager\.com\/ns\.html/i;

function hiddenIframes(code: string): boolean {
  const tags = code.match(/<iframe\b[^>]*>/gi) ?? [];
  return tags.some((tag) => {
    const hidden =
      /\b(?:width|height)\s*=\s*["']?0(?:px)?["'\s>]/i.test(tag) ||
      /display\s*:\s*none|visibility\s*:\s*hidden/i.test(tag);
    if (!hidden) return false;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.trim() ?? "";
    return !ALLOWED_HIDDEN_IFRAME_SRC.test(src);
  });
}

export function analyzeCustomCodeRisk(codes: Array<string | null | undefined>): CustomCodeRiskReport {
  const code = codes.filter((c): c is string => typeof c === "string" && c.trim().length > 0).join("\n");
  if (!code) return { hijack: [], obfuscation: [] };
  const hijack = HIJACK_PATTERNS.filter((p) => p.re.test(code)).map((p) => p.label);
  if (hiddenIframes(code)) hijack.push("iframe invisível");
  const obfuscation = OBFUSCATION_PATTERNS.filter((p) => p.re.test(code)).map((p) => p.label);
  return { hijack, obfuscation };
}
