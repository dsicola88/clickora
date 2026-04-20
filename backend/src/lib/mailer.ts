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
 * Resend: API HTTPS (recomendado em cloud — evita timeouts de SMTP outbound).
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
async function sendViaResendHttpApi(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 22_000);
  try {
    const htmlBody =
      params.html ?? `<pre style="font-family:system-ui,sans-serif">${escapeHtml(params.text)}</pre>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: htmlBody,
      }),
      signal: controller.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      let msg = `Resend API HTTP ${res.status}`;
      try {
        const j = JSON.parse(raw) as { message?: string };
        if (j.message) msg = `${msg}: ${j.message}`;
        else if (raw) msg = `${msg}: ${raw.slice(0, 280)}`;
      } catch {
        if (raw) msg = `${msg}: ${raw.slice(0, 280)}`;
      }
      return { sent: false, reason: msg };
    }
    return { sent: true };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        sent: false,
        reason:
          "Timeout ao contactar api.resend.com (HTTPS). Verifique rede ou tente SMTP explícito (SMTP_HOST=smtp.resend.com).",
      };
    }
    const msg = e instanceof Error ? e.message : "Erro ao enviar via Resend API";
    return { sent: false, reason: msg };
  } finally {
    clearTimeout(kill);
  }
}

/**
 * Envio transacional: com só `RESEND_API_KEY` + `SMTP_FROM` usa **API HTTPS Resend** (sem SMTP).
 * Com `SMTP_HOST` definido usa Nodemailer (Gmail, Resend SMTP, etc.).
 */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendMailResult> {
  const from = process.env.SMTP_FROM?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const explicitHost = process.env.SMTP_HOST?.trim();

  if (!from) {
    return {
      sent: false,
      reason:
        "Servidor sem remetente. Defina SMTP_FROM e (RESEND_API_KEY ou SMTP_HOST) no .env da API.",
    };
  }

  if (resendKey && !explicitHost) {
    return sendViaResendHttpApi({
      apiKey: resendKey,
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }

  if (!explicitHost) {
    return {
      sent: false,
      reason:
        "Servidor sem SMTP/API. Defina SMTP_FROM e (RESEND_API_KEY ou SMTP_HOST) no .env da API.",
    };
  }

  let host = explicitHost;
  let port = Number(process.env.SMTP_PORT || "587");
  let secure = process.env.SMTP_SECURE === "true" || port === 465;
  let user = process.env.SMTP_USER?.trim();
  let pass = process.env.SMTP_PASS?.trim() || resendKey;

  if (!user && pass && host.includes("resend.com")) {
    user = "resend";
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
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
