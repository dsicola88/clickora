import { systemPrisma } from "./prisma";
import { sendTransactionalEmail } from "./mailer";
import { buildSaleNotice } from "./saleNotice";
import { notifyTelegramSale } from "./telegramNotifications";
import { sendWebPushToUser } from "./webPush";

function resultsUrl(): string {
  const raw = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "https://www.dclickora.com";
  const base = raw.split(",")[0]?.trim().replace(/\/$/, "") || "https://www.dclickora.com";
  return `${base}/resultados/relatorios/conversoes`;
}

/**
 * Avisa o dono da conta quando uma venda fica aprovada.
 * O envio não depende de a pessoa estar na dclickora nem no Google:
 * o e-mail vai para o endereço de alertas (ou o da conta) e o push para os aparelhos já ligados.
 */
export async function notifyApprovedSale(input: {
  userId: string;
  conversionId: string;
  platform: string;
  product?: string | null;
  amount: string | null;
  currency: string | null;
  orderId: string | null;
  linkedToClick: boolean;
}): Promise<{ sent: boolean; reason?: string }> {
  const notice = buildSaleNotice({
    platform: input.platform,
    product: input.product,
    amount: input.amount,
    currency: input.currency,
    orderId: input.orderId,
    linkedToClick: input.linkedToClick,
    resultsUrl: resultsUrl(),
  });

  notifyTelegramSale(input.userId, {
    platform: input.platform,
    product: input.product,
    amount: input.amount ?? undefined,
    currency: input.currency ?? undefined,
    conversionId: input.conversionId,
    linkedToClick: input.linkedToClick,
  });

  void sendWebPushToUser(input.userId, {
    title: notice.pushTitle,
    body: notice.pushBody,
    url: "/resultados/relatorios/conversoes",
    tag: `sale-${input.conversionId}`,
    chime: true,
  }).catch((err) => console.warn("[sale push]", input.userId, err));

  const user = await systemPrisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, saleNotifyEmail: true },
  });
  const to = (user?.saleNotifyEmail?.trim() || user?.email || "").trim();
  if (!to) return { sent: false, reason: "sem_email" };

  const mail = await sendTransactionalEmail({
    to,
    subject: notice.subject,
    text: notice.text,
    html: notice.html,
  });
  if (!mail.sent) {
    console.warn("[sale email]", input.userId, mail.reason);
    return mail;
  }
  return { sent: true };
}
