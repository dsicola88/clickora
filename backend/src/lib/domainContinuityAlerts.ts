/**
 * Alertas de continuidade de domínios (Etapa 2/3): queda, recuperação, failover e auto-recovery.
 * Canais existentes: e-mail transacional, Telegram («alertas de problemas») e Web Push.
 * Anti-spam: só transições de estado geram alerta + cooldown por domínio/tipo.
 */
import type { DomainHealthStatus } from "@prisma/client";
import { systemPrisma } from "./prisma";
import { sendTransactionalEmail } from "./mailer";
import { sendTelegram } from "./telegram";
import { sendWebPushToUser } from "./webPush";
import { decryptSecretField } from "./fieldEncryption";

export type DomainContinuityAlert =
  | { kind: "domain_down"; domainId: string; hostname: string; error: string | null; failedLayer: string | null }
  | { kind: "domain_recovered"; domainId: string; hostname: string }
  | { kind: "failover"; domainId: string; fromHostname: string | null; toHostname: string | null; presellCount: number; accountLevel: boolean }
  | { kind: "recovery"; domainId: string; fromHostname: string | null; toHostname: string | null; presellCount: number; accountLevel: boolean };

/** Decide o alerta de saúde a partir da transição (degraded não alerta: ainda abaixo do limiar). */
export function decideDomainHealthAlert(input: {
  previousStatus: DomainHealthStatus | string;
  nextStatus: DomainHealthStatus | string;
}): "domain_down" | "domain_recovered" | null {
  if (input.nextStatus === "down" && input.previousStatus !== "down") return "domain_down";
  if (input.previousStatus === "down" && input.nextStatus === "healthy") return "domain_recovered";
  return null;
}

export function domainAlertsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DOMAIN_HEALTH_ALERTS_ENABLED?.trim().toLowerCase() !== "false";
}

const ALERT_COOLDOWN_MS = 30 * 60_000;
const lastAlertAt = new Map<string, number>();

/** Cooldown in-process por domínio/tipo (evita tempestade de alertas em flapping). */
export function shouldSendAlertNow(key: string, now: number = Date.now(), cooldownMs = ALERT_COOLDOWN_MS): boolean {
  const prev = lastAlertAt.get(key);
  if (prev != null && now - prev < cooldownMs) return false;
  lastAlertAt.set(key, now);
  if (lastAlertAt.size > 5_000) {
    for (const [k, t] of lastAlertAt) {
      if (now - t > cooldownMs) lastAlertAt.delete(k);
    }
  }
  return true;
}

export function resetAlertCooldownsForTests(): void {
  lastAlertAt.clear();
}

function continuityPanelUrl(): string {
  const raw = process.env.FRONTEND_URL || process.env.APP_PUBLIC_URL || "https://www.dclickora.com";
  const base = raw.split(",")[0]?.trim().replace(/\/$/, "") || "https://www.dclickora.com";
  return `${base}/configuracoes/dominio#continuidade`;
}

const FINAL_URL_NOTE =
  "Os anúncios não foram alterados: reveja as Final URLs no assistente de continuidade e aprove manualmente qualquer troca.";

/** Texto (PT) do alerta — puro para testes. */
export function formatDomainContinuityAlert(alert: DomainContinuityAlert): { subject: string; lines: string[] } {
  switch (alert.kind) {
    case "domain_down":
      return {
        subject: `[dclickora] Domínio indisponível — ${alert.hostname}`,
        lines: [
          `O domínio ${alert.hostname} falhou nas verificações consecutivas${alert.failedLayer ? ` (${alert.failedLayer.toUpperCase()})` : ""}.`,
          alert.error ? `Detalhe: ${alert.error}` : "",
          FINAL_URL_NOTE,
        ].filter(Boolean),
      };
    case "domain_recovered":
      return {
        subject: `[dclickora] Domínio recuperado — ${alert.hostname}`,
        lines: [`O domínio ${alert.hostname} voltou a responder (DNS, SSL e HTTP OK).`],
      };
    case "failover":
      return {
        subject: `[dclickora] Failover automático — ${alert.fromHostname ?? "domínio"} → ${alert.toHostname ?? "backup"}`,
        lines: [
          alert.accountLevel
            ? `O domínio principal da conta passou para ${alert.toHostname ?? "o backup"}.`
            : "",
          alert.presellCount > 0 ? `${alert.presellCount} presell(s) passaram para o domínio de backup autorizado.` : "",
          "Sem redirects nem cloaking: o domínio original continua a servir a mesma página quando voltar.",
          FINAL_URL_NOTE,
        ].filter(Boolean),
      };
    case "recovery":
      return {
        subject: `[dclickora] Recuperação automática — ${alert.toHostname ?? "domínio"}`,
        lines: [
          alert.accountLevel ? `O domínio principal voltou a ser ${alert.toHostname ?? "o original"}.` : "",
          alert.presellCount > 0 ? `${alert.presellCount} presell(s) voltaram ao domínio original.` : "",
          FINAL_URL_NOTE,
        ].filter(Boolean),
      };
  }
}

export async function dispatchDomainContinuityAlert(userId: string, alert: DomainContinuityAlert): Promise<boolean> {
  if (!domainAlertsEnabled()) return false;
  if (!shouldSendAlertNow(`${alert.domainId}:${alert.kind}`)) return false;
  const { subject, lines } = formatDomainContinuityAlert(alert);
  const panelUrl = continuityPanelUrl();
  const text = `${lines.join("\n")}\n\nPainel de continuidade: ${panelUrl}`;

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
  if (!user) return false;

  const tasks: Array<Promise<unknown>> = [];
  const to = (user.saleNotifyEmail?.trim() || user.email || "").trim();
  if (to) {
    tasks.push(
      sendTransactionalEmail({ to, subject, text }).then((r) => {
        if (!r.sent && process.env.NODE_ENV === "production") {
          console.warn("[domainContinuityAlerts] e-mail não enviado:", (r as { reason?: string }).reason);
        }
      }),
    );
  }
  if (user.telegramNotifyPostbackError) {
    const token = decryptSecretField(user.telegramBotToken)?.trim();
    const chat = user.telegramChatId?.trim();
    if (token && chat) {
      tasks.push(sendTelegram(token, chat, `${subject.replace(/^\[dclickora\]\s*/, "")}\n${text}`));
    }
  }
  tasks.push(
    sendWebPushToUser(userId, {
      title: subject.replace(/^\[dclickora\]\s*/, ""),
      body: lines[0] ?? subject,
      url: "/configuracoes/dominio#continuidade",
      tag: `domain-${alert.domainId}-${alert.kind}`,
    }),
  );
  await Promise.allSettled(tasks);
  return true;
}
