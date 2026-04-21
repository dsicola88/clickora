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

type SmtpResolved = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
};

/**
 * Resolve host/porta/auth: SMTP explícito no .env, ou atalho Resend (smtp.resend.com:587 + user `resend`).
 * @see https://resend.com/docs/send-with-smtp
 */
function resolveSmtp(): SmtpResolved | null {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const explicitHost = process.env.SMTP_HOST?.trim();

  if (explicitHost) {
    const port = Number(process.env.SMTP_PORT || "587");
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    let user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim() || resendKey;
    if (!user && pass && explicitHost.includes("resend.com")) {
      user = "resend";
    }
    return { host: explicitHost, port, secure, user: user || undefined, pass: pass || undefined };
  }

  if (resendKey) {
    return {
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      user: "resend",
      pass: resendKey,
    };
  }

  return null;
}

/**
 * Envio transacional via Nodemailer (SMTP).
 * Só `RESEND_API_KEY` + `SMTP_FROM` → liga a smtp.resend.com (STARTTLS na porta 587).
 */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  const from = process.env.SMTP_FROM?.trim();
  if (!from) {
    return {
      sent: false,
      reason:
        "Servidor sem remetente. Defina SMTP_FROM e (RESEND_API_KEY ou SMTP_HOST) no .env da API.",
    };
  }

  const smtp = resolveSmtp();
  if (!smtp) {
    return {
      sent: false,
      reason:
        "Servidor sem SMTP. Defina SMTP_FROM e (RESEND_API_KEY ou SMTP_HOST) no .env da API.",
    };
  }

  const auth =
    smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined;

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth,
      connectionTimeout: 12_000,
      greetingTimeout: 10_000,
      socketTimeout: 25_000,
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
