import { systemPrisma } from "./prisma";
import { sendTelegram } from "./telegram";
import { decryptSecretField } from "./fieldEncryption";
import { formatSaleCommission, saleNoticePlatform, saleNoticeProduct } from "./saleNotice";

const TELEGRAM_USER_SELECT = {
  telegramBotToken: true,
  telegramChatId: true,
  telegramNotifySale: true,
  telegramNotifyPostbackError: true,
  telegramNotifyClick: true,
} as const;

/** Nova venda (conversão criada no webhook de afiliados). */
export function notifyTelegramSale(
  userId: string,
  detail: {
    platform: string;
    product?: string | null;
    amount?: string;
    currency?: string;
    conversionId?: string;
    linkedToClick?: boolean;
  },
): void {
  void (async () => {
    const user = await systemPrisma.user.findUnique({
      where: { id: userId },
      select: TELEGRAM_USER_SELECT,
    });
    if (!user?.telegramNotifySale) return;
    const token = decryptSecretField(user.telegramBotToken)?.trim();
    const chat = user.telegramChatId?.trim();
    if (!token || !chat) return;
    const product = saleNoticeProduct(detail.product);
    const lines = [
      "Nova venda aprovada!",
      `Rede: ${saleNoticePlatform(detail.platform)}`,
      `Produto: ${product || "a rede não enviou o produto"}`,
      `Comissão: ${formatSaleCommission(detail.amount ?? null, detail.currency ?? null)}`,
      detail.linkedToClick === false ? "Clique: a rede não devolveu o clique" : null,
      detail.conversionId ? `Conversão: ${detail.conversionId}` : null,
    ].filter(Boolean);
    const r = await sendTelegram(token, chat, lines.join("\n"));
    if (!r.ok) console.warn("[telegram sale]", userId, r.error);
  })();
}

/** Problema no postback (clique inválido, falta de click_id, etc.). */
export function notifyTelegramPostbackWarning(
  userId: string,
  detail: { platform: string; result: string; clickId: string | null },
): void {
  void (async () => {
    const user = await systemPrisma.user.findUnique({
      where: { id: userId },
      select: TELEGRAM_USER_SELECT,
    });
    if (!user?.telegramNotifyPostbackError) return;
    const token = decryptSecretField(user.telegramBotToken)?.trim();
    const chat = user.telegramChatId?.trim();
    if (!token || !chat) return;
    const text = [
      "Alerta de postback (dclickora)",
      `Rede: ${detail.platform}`,
      `Resultado: ${detail.result}`,
      detail.clickId ? `click_id: ${detail.clickId}` : "click_id: (ausente)",
    ].join("\n");
    const r = await sendTelegram(token, chat, text);
    if (!r.ok) console.warn("[telegram postback]", userId, r.error);
  })();
}

/** Novo clique (opcional — pode ser frequente). */
export function notifyTelegramClick(
  userId: string,
  detail: { presellTitle: string; clickId: string; campaign?: string | null },
): void {
  void (async () => {
    const user = await systemPrisma.user.findUnique({
      where: { id: userId },
      select: TELEGRAM_USER_SELECT,
    });
    if (!user?.telegramNotifyClick) return;
    const token = decryptSecretField(user.telegramBotToken)?.trim();
    const chat = user.telegramChatId?.trim();
    if (!token || !chat) return;
    const text = [
      "Novo clique (dclickora)",
      `Presell: ${detail.presellTitle}`,
      `Clique: ${detail.clickId}`,
      detail.campaign ? `Campanha: ${detail.campaign}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const r = await sendTelegram(token, chat, text);
    if (!r.ok) console.warn("[telegram click]", userId, r.error);
  })();
}
