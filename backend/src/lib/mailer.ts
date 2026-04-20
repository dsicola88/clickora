import nodemailer from "nodemailer";

export type SendMailResult = { sent: true } | { sent: false; reason: string };

/** True se o envio por e-mail pode ser tentado (SMTP explícito ou só Resend com `RESEND_API_KEY`). */
export function isTransactionalEmailConfigured(): boolean {
  const from = process.env.SMTP_FROM?.trim();
  if (!from) return false;
  if (process.env.SMTP_HOST?.trim()) return true;
  if (process.env.RESEND_API_KEY?.trim()) return true;
  return false;
}

/**
 * Envio transacional via SMTP (opcional). Sem variáveis de ambiente, devolve erro claro.
 * Suporta Resend: `RESEND_API_KEY` + `SMTP_FROM` (usa smtp.resend.com:465, user `resend`).
 * Ou SMTP genérico: `SMTP_HOST`, `SMTP_FROM`, e opcionalmente `SMTP_USER` / `SMTP_PASS` (a pass pode ser `RESEND_API_KEY`).
 */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  const from = process.env.SMTP_FROM?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  let host = process.env.SMTP_HOST?.trim();
  let port = Number(process.env.SMTP_PORT || "587");
  let secure = process.env.SMTP_SECURE === "true" || port === 465;
  let user = process.env.SMTP_USER?.trim();
  let pass = process.env.SMTP_PASS?.trim() || resendKey;

  if (!host && from && resendKey) {
    host = "smtp.resend.com";
    port = 465;
    secure = true;
    user = "resend";
    pass = resendKey;
  }

  if (!from || !host) {
    return {
      sent: false,
      reason:
        "Servidor sem SMTP configurado. Defina SMTP_FROM e (SMTP_HOST ou RESEND_API_KEY) no .env da API. Opcionalmente SMTP_PORT, SMTP_USER, SMTP_PASS.",
    };
  }

  if (!user && pass && host.includes("resend.com")) {
    user = "resend";
  }

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
