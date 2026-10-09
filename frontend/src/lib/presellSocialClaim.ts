/**
 * Frase modelo que o import antigo gravava quando a página não tinha prova social.
 * Não é um dado da oferta.
 */
export function stripStockSocialClaim(line: string): string {
  const t = line.trim();
  if (!t) return "";
  const stock =
    /\b8\b/.test(t) &&
    /\b10\b/.test(t) &&
    /prefer|prefieren|preferem|bevorzugen|pr[eé]f[eè]r|preferiscono|wybiera|tercih|पसंद|يفضل|voorkeur|föredrar|foretrekker|foretrækker/i.test(
      t,
    );
  return stock ? "" : t;
}
