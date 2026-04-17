import { systemPrisma } from "./prisma";
import { sendTransactionalEmail } from "./mailer";
import { sendTelegram } from "./telegram";
import { decryptSecretField } from "./fieldEncryption";

/**
 * Notifica o utilizador quando uma conversão falha ao sincronizar com Google Ads ou Meta CAPI
 * (e-mail se SMTP configurado; Telegram se alertas de «problemas» estiverem ativos).
 */
export function notifyUserConversionSyncFailure(
  userId: string,
  detail: { platform: "google_ads" | "meta_capi"; conversionId: string; error: string },
): void {
  void (async () => {
    try {
      const user = await systemPrisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          saleNotifyEmail: true,
          telegramBotToken: true,
          telegramChatId: true,
          telegramNotifyPostbackError: true,
        },
      });
      if (!user) return;

      const label = detail.platform === "google_ads" ? "Google Ads" : "Meta CAPI";
      const shortErr = detail.error.slice(0, 2000);
      const to = (user.saleNotifyEmail?.trim() || user.email).trim();

      const mail = await sendTransactionalEmail({
        to,
        subject: `[dclickora] Falha de sincronização (${label})`,
        text:
          `Falha ao enviar uma conversão para ${label}.\n\n` +
          `ID da conversão: ${detail.conversionId}\n\n` +
          `Erro (resumo):\n${shortErr}\n\n` +
          `Em Tracking → Relatórios pode ver o estado de sincronização por conversão.`,
      });
      if (!mail.sent && process.env.NODE_ENV === "production") {
        console.warn("[syncFailureAlerts] e-mail não enviado:", (mail as { reason: string }).reason);
      }

      if (!user.telegramNotifyPostbackError) return;
      const token = decryptSecretField(user.telegramBotToken)?.trim();
      const chat = user.telegramChatId?.trim();
      if (!token || !chat) return;

      const text = [
        `Falha sync ${label} (dclickora)`,
        `Conversão: ${detail.conversionId}`,
        shortErr.slice(0, 3500),
      ].join("\n");
      const r = await sendTelegram(token, chat, text);
      if (!r.ok) console.warn("[syncFailureAlerts] Telegram:", userId, r.error);
    } catch (e) {
      console.warn("[notifyUserConversionSyncFailure]", e);
    }
  })();
}
