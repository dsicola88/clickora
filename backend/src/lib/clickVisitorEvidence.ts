/**
 * Evidência de visitante para relatórios — só a partir de IP e User-Agent gravados.
 * Não inventa país, rede nem bot: ou há match explícito, ou fica limpo.
 *
 * Só afecta a coluna Situação / KPIs de relatório — não altera cloaking nem o HTML servido.
 */
import { detectBot } from "./detectBot";
import { datacenterClickPlace } from "./ipNetworkClass";
import { classifyReportCloudIp } from "./reportCloudIpRanges";

export type ClickVisitorEvidence = {
  is_bot: boolean;
  bot_label: string | null;
  unqualified: boolean;
  unqualified_reason: string | null;
  ip_network: string | null;
  /** Fonte da classificação Situação no relatório. */
  evidence: "datacenter_ip" | "report_cloud_ip" | "bot_ua" | "none";
};

/**
 * Lê só colunas/primários reais do evento.
 * - Datacenter: listas CDN77/AWS/GCP (oficiais) + CIDRs report-only (Google/Azure/DO…).
 * - Bot: classificar User-Agent agora (não confiar só em metadata antigo).
 * - country_source=cdn77: não forçar datacenter pelo IP do nó.
 */
export function resolveClickVisitorEvidence(input: {
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}): ClickVisitorEvidence {
  const meta = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const fromCdnVisitor = meta.country_source === "cdn77";
  const dc = fromCdnVisitor ? null : datacenterClickPlace(input.ipAddress);
  if (dc?.unqualified) {
    return {
      is_bot: false,
      bot_label: null,
      unqualified: true,
      unqualified_reason: dc.unqualified_reason,
      ip_network: dc.ip_network,
      evidence: "datacenter_ip",
    };
  }
  // Segunda camada (só relatório): Google / Azure / DO / AWS-CN que escapam às listas oficiais.
  if (!fromCdnVisitor) {
    const reportNet = classifyReportCloudIp(input.ipAddress);
    if (reportNet) {
      return {
        is_bot: false,
        bot_label: null,
        unqualified: true,
        unqualified_reason: `Rede ${reportNet.name} (${reportNet.place}). IP de cloud/hosting — marcado no relatório; não altera a página pública.`,
        ip_network: reportNet.name,
        evidence: "report_cloud_ip",
      };
    }
  }
  const bot = detectBot(input.userAgent);
  if (bot.isBot) {
    return {
      is_bot: true,
      bot_label: bot.label,
      unqualified: false,
      unqualified_reason: null,
      ip_network: null,
      evidence: "bot_ua",
    };
  }
  return {
    is_bot: false,
    bot_label: null,
    unqualified: false,
    unqualified_reason: null,
    ip_network: null,
    evidence: "none",
  };
}
