/** Venda aprovada que deve avisar o afiliado (e-mail, push e Telegram). */
export function isApprovedSaleNotice(result: string): boolean {
  return result === "created" || result === "created_unattributed" || result === "approved_from_pending";
}

export type SaleNoticeInput = {
  platform: string;
  /** Código do produto que a rede enviou. Vazio ou macro `{…}` não se inventa. */
  product?: string | null;
  amount: string | null;
  currency: string | null;
  orderId: string | null;
  linkedToClick: boolean;
  resultsUrl: string;
};

export type SaleNotice = {
  subject: string;
  text: string;
  html: string;
  pushTitle: string;
  pushBody: string;
};

/** Comissão tal como a rede a enviou. Sem valor, não se inventa um número. */
export function formatSaleCommission(amount: string | null, currency: string | null): string {
  if (!amount?.trim()) return "A rede não enviou a comissão";
  const n = Number(amount.trim().replace(",", "."));
  const cur = (currency || "").trim().toUpperCase();
  if (!Number.isFinite(n)) return `${amount.trim()}${cur ? ` ${cur}` : ""}`;
  const formatted = n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cur ? `${formatted} ${cur}` : formatted;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PLATFORM_LABEL: Record<string, string> = {
  maxweb: "MaxWeb",
  buygoods: "BuyGoods",
  smartadv: "SmartAdv",
  digistore24: "Digistore24",
  hotmart: "Hotmart",
  clickbank: "ClickBank",
  warriorplus: "WarriorPlus",
  jvzoo: "JVZoo",
};

/** Nome da rede no aviso. O identificador interno passa a MaxWeb, BuyGoods, etc. */
export function saleNoticePlatform(raw: string | null | undefined): string {
  const value = (raw || "").trim();
  if (!value) return "rede";
  return PLATFORM_LABEL[value.toLowerCase()] || value;
}

/** Código de produto da rede. Uma macro por substituir não conta como produto. */
export function saleNoticeProduct(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value || /[{}]/.test(value)) return null;
  return value.slice(0, 120);
}

/**
 * Texto do aviso de venda. A comissão e o produto são os que a rede enviou no postback.
 * Não inclui dados do comprador.
 */
export function buildSaleNotice(input: SaleNoticeInput): SaleNotice {
  const platform = saleNoticePlatform(input.platform);
  const commission = formatSaleCommission(input.amount, input.currency);
  const product = saleNoticeProduct(input.product) || "A rede não enviou o produto";
  const order = input.orderId?.trim() || "—";
  const linkLine = input.linkedToClick
    ? "A venda ficou ligada a um clique."
    : "A venda ficou registada. A rede não devolveu o clique, por isso não entra numa campanha.";
  const subject = input.linkedToClick
    ? `[dclickora] Venda — ${platform}`
    : `[dclickora] Venda sem clique — ${platform}`;

  const text = [
    "Nova venda aprovada na dclickora.",
    "Este aviso chega ao e-mail mesmo com a conta fechada.",
    "",
    `Rede: ${platform}`,
    `Produto: ${product}`,
    `Comissão: ${commission}`,
    `Encomenda: ${order}`,
    linkLine,
    "",
    `Abrir conversões: ${input.resultsUrl}`,
  ].join("\n");

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:#0f172a">${escapeHtml(value)}</td></tr>`;

  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;color:#0f172a">
<p style="margin:0 0 8px;font-size:18px;font-weight:650">Nova venda aprovada</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.45;color:#334155">A rede confirmou a venda. Este e-mail chega mesmo com a dclickora fechada.</p>
<table style="border-collapse:collapse;font-size:14px;line-height:1.4">
${row("Rede", platform)}
${row("Produto", product)}
${row("Comissão", commission)}
${row("Encomenda", order)}
${row("Clique", input.linkedToClick ? "Ligado" : "A rede não devolveu o clique")}
</table>
<p style="margin:16px 0 0;font-size:14px"><a href="${escapeHtml(input.resultsUrl)}" style="color:#0f766e">Abrir conversões</a></p>
</div>`;

  const pushBody = input.linkedToClick
    ? `${product} · Comissão: ${commission}`
    : `${product} · Comissão: ${commission} · sem clique`;

  return {
    subject,
    text,
    html,
    pushTitle: "Nova venda aprovada!",
    pushBody,
  };
}
