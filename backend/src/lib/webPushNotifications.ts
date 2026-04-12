import { sendWebPushToUser } from "./webPush";

/**
 * Nova conversão (postback) — alerta no browser/telemóvel com Web Push.
 * `userId` deve ser o dono da conversão (ex.: `user.id` no webhook), nunca um ID arbitrário do cliente.
 */
export function notifyWebPushConversion(
  userId: string,
  detail: { platform: string; amount?: string; currency?: string },
): void {
  void (async () => {
    const lines: string[] = [`Rede: ${detail.platform}`];
    if (detail.amount != null) {
      lines.push(`Valor: ${detail.amount} ${detail.currency || ""}`.trim());
    }
    await sendWebPushToUser(userId, {
      title: "Nova venda (dclickora)",
      body: lines.join(" · "),
      url: "/tracking/dashboard",
    });
  })();
}
