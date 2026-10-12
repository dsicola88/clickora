/** Venda aprovada que deve avisar o afiliado (e-mail, push e Telegram). */
export function isApprovedSaleNotice(result: string): boolean {
  return result === "created" || result === "created_unattributed" || result === "approved_from_pending";
}

export type SaleNoticeInput = {
  platform: string;
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

function money(amount: string | null, currency: string | null): string {
  if (!amount) return "A rede não enviou a comissão";
  return `${amount}${currency ? ` ${currency}` : ""}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Texto do aviso de venda. A comissão é o valor que a rede enviou no postback.
 * Não inclui dados do comprador.
 */
export function buildSaleNotice(input: SaleNoticeInput): SaleNotice {
  const platform = input.platform.trim() || "rede";
  const commission = money(input.amount, input.currency);
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
${row("Comissão", commission)}
${row("Encomenda", order)}
${row("Clique", input.linkedToClick ? "Ligado" : "A rede não devolveu o clique")}
</table>
<p style="margin:16px 0 0;font-size:14px"><a href="${escapeHtml(input.resultsUrl)}" style="color:#0f766e">Abrir conversões</a></p>
</div>`;

  const pushBody = input.linkedToClick
    ? `${platform} · ${commission}`
    : `${platform} · ${commission} · sem clique`;

  return {
    subject,
    text,
    html,
    pushTitle: "Nova venda na dclickora",
    pushBody,
  };
}
