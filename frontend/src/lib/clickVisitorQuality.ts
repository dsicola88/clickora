/**
 * Qualidade do visitante no relatório de cliques.
 * Separado de «Pago/Orgânico» (origem do anúncio).
 */

export type ClickVisitorKind = "real" | "bot" | "datacenter";

export type ClickVisitorQuality = {
  kind: ClickVisitorKind;
  /** Etiqueta curta na tabela. */
  label: string;
  /** Tooltip / título. */
  detail: string;
};

type QualityInput = {
  is_bot?: boolean;
  bot_label?: string | null;
  unqualified?: boolean;
  unqualified_reason?: string | null;
  ip_network?: string | null;
};

/**
 * Prioridade: datacenter → bot → real.
 * Datacenter inclui cloud (AWS/GCP/…) mesmo com UA de telemóvel.
 */
export function resolveClickVisitorQuality(e: QualityInput): ClickVisitorQuality {
  if (e.unqualified) {
    const net = (e.ip_network || "").trim();
    const label = net ? `Datacenter (${net})` : "Datacenter";
    return {
      kind: "datacenter",
      label,
      detail:
        (e.unqualified_reason || "").trim() ||
        "IP de cloud/CDN — não é acesso residencial. Não conta como clique bom e não abre o hoplink.",
    };
  }
  if (e.is_bot) {
    const bot = (e.bot_label || "").trim();
    return {
      kind: "bot",
      label: bot ? `Bot (${bot})` : "Bot",
      detail: bot
        ? `Identificado como bot pelo User-Agent (${bot}).`
        : "Identificado como bot pelo User-Agent.",
    };
  }
  return {
    kind: "real",
    label: "Real",
    detail: "Visitante sem sinais de bot nem IP de datacenter/cloud.",
  };
}
