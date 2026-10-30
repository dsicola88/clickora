/**
 * Evidência de visitante para relatórios — só a partir de IP e User-Agent gravados.
 * Não inventa país, rede nem bot: ou há match explícito, ou fica limpo.
 *
 * Só afecta a coluna Situação / KPIs de relatório — não altera cloaking nem o HTML servido.
 */
import { isCdn77EdgeIp } from "./cdn77Visitor";
import { detectBot } from "./detectBot";
import { isFastlyEdgeIp } from "./fastlyEdges";
import { datacenterClickPlace } from "./ipNetworkClass";
import { classifyReportCloudIp } from "./reportCloudIpRanges";

export type ClickVisitorEvidence = {
  is_bot: boolean;
  bot_label: string | null;
  unqualified: boolean;
  unqualified_reason: string | null;
  ip_network: string | null;
  /** Fonte da classificação Situação no relatório. */
  evidence: "datacenter_ip" | "report_cloud_ip" | "edge_ip" | "bot_ua" | "none";
};

/**
 * Lê só colunas/primários reais do evento.
 * - Nó CDN (CDN77/Fastly): IP gravado é o edge, não o visitante.
 * - Datacenter: listas CDN77/AWS/GCP (oficiais) + CIDRs report-only (Google/Azure/DO…).
 * - Bot: classificar User-Agent agora (não confiar só em metadata antigo).
 * - country_source=cdn77: NÃO salta a classificação — o IP gravado deve ser o visitante
 *   (ex.: AWS atrás de geo CDN77 continua Cloud no relatório).
 */
export function resolveClickVisitorEvidence(input: {
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}): ClickVisitorEvidence {
  void input.metadata;
  const ip = input.ipAddress;

  if (isCdn77EdgeIp(ip)) {
    return {
      is_bot: false,
      bot_label: null,
      unqualified: true,
      unqualified_reason:
        "IP de nó CDN77 (edge). Não é o endereço residencial do visitante — marcado no relatório.",
      ip_network: "CDN77",
      evidence: "edge_ip",
    };
  }
  if (isFastlyEdgeIp(ip)) {
    return {
      is_bot: false,
      bot_label: null,
      unqualified: true,
      unqualified_reason:
        "IP de nó Fastly (edge). Não é o endereço residencial do visitante — marcado no relatório.",
      ip_network: "Fastly",
      evidence: "edge_ip",
    };
  }

  const dc = datacenterClickPlace(ip);
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

  const reportNet = classifyReportCloudIp(ip);
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

/**
 * Etiqueta Situação alinhada ao frontend `resolveClickVisitorQuality`.
 * Usada no CSV e em contratos E2E — não inventa estado.
 */
export function situationLabelFromEvidence(
  ev: Pick<ClickVisitorEvidence, "is_bot" | "bot_label" | "unqualified" | "ip_network">,
): string {
  if (ev.unqualified) {
    const net = (ev.ip_network || "").trim();
    return net ? `Datacenter (${net})` : "Datacenter";
  }
  if (ev.is_bot) {
    const bot = (ev.bot_label || "").trim();
    const isGoogle =
      /google/i.test(bot) || /adsbot|inspectiontool|googlebot|mediapartners/i.test(bot);
    if (isGoogle) return bot ? `Crawler Google (${bot})` : "Crawler Google";
    return bot ? `Bot (${bot})` : "Bot";
  }
  return "Real";
}
