import { systemPrisma } from "./prisma";
import { sendTransactionalEmail } from "./mailer";
import { sendTelegram } from "./telegram";
import { decryptSecretField } from "./fieldEncryption";

/**
 * Notificação proactiva: falha ao enviar uma conversão aprovada para Google Ads, Meta CAPI ou TikTok Events API.
 * (E-mail com SMTP; Telegram se «alertas de problemas» estiverem activos no perfil.)
 */
export function notifyUserConversionSyncFailure(
  userId: string,
  detail: { platform: "google_ads" | "meta_capi" | "tiktok_events"; conversionId: string; error: string },
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

      const label =
        detail.platform === "google_ads"
          ? "Google Ads"
          : detail.platform === "meta_capi"
            ? "Meta CAPI"
            : "TikTok Events API";
      const shortErr = detail.error.slice(0, 2000);
      const to = (user.saleNotifyEmail?.trim() || user.email).trim();

      const mail = await sendTransactionalEmail({
        to,
        subject: `[dclickora] Falha de envio de conversão — ${label}`,
        text:
          `Não foi possível concluir o envio server-side (post-venda) para ${label}.\n\n` +
          `ID da conversão: ${detail.conversionId}\n\n` +
          `Detalhe do erro (resumo):\n${shortErr}\n\n` +
          `Em Tracking → Relatórios → Conversões consulte a coluna de sincronização e valide credenciais, permissões e identificadores de clique (GCLID, fbclid, ttclid) conforme a plataforma.`,
      });
      if (!mail.sent && process.env.NODE_ENV === "production") {
        console.warn("[syncFailureAlerts] e-mail não enviado:", (mail as { reason: string }).reason);
      }

      if (!user.telegramNotifyPostbackError) return;
      const token = decryptSecretField(user.telegramBotToken)?.trim();
      const chat = user.telegramChatId?.trim();
      if (!token || !chat) return;

      const text = [
        `[dclickora] Falha de envio — ${label}`,
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
