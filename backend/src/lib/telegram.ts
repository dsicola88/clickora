/**
 * Telegram Bot API — envio de mensagens para o chat configurado pelo utilizador.
 * @see https://core.telegram.org/bots/api#sendmessage
 */

export type SendTelegramResult = { ok: true } | { ok: false; error: string };

export async function sendTelegram(botToken: string, chatId: string, text: string): Promise<SendTelegramResult> {
  const token = botToken.trim();
  const chat = chatId.trim();
  if (!token || !chat) {
    return { ok: false, error: "Token ou chat em falta" };
  }
  const body = {
    chat_id: chat,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
  };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
