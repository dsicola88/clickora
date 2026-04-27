/**
 * CSS avançado alinhado a editores tipo Elementor: ou lista de declarações no nó, ou
 * regras completas (use `&` como o elemento actual).
 */
export function buildScopedStylesheet(selector: string, css: string): string {
  const t = css.trim();
  if (!t) return "";
  if (t.startsWith("@") || t.includes("{")) {
    return t.replace(/&/g, selector);
  }
  return `${selector} { ${t} }`;
}
