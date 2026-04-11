import nodemailer from "nodemailer";

export type SendMailResult = { sent: true } | { sent: false; reason: string };

/**
 * Envio transacional via SMTP (opcional). Sem variáveis de ambiente, devolve erro claro.
 */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) {
    return {
      sent: false,
      reason:
        "Servidor sem SMTP configurado. Defina SMTP_HOST e SMTP_FROM (e opcionalmente SMTP_PORT, SMTP_USER, SMTP_PASS) no .env da API.",
    };
  }

  const port = Number(process.env.SMTP_PORT || "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html ?? `<pre style="font-family:system-ui,sans-serif">${escapeHtml(params.text)}</pre>`,
    });
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido ao enviar e-mail";
    return { sent: false, reason: msg };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
