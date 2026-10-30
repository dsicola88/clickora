/**
 * Qualidade do visitante no relatório (rótulos para o afiliado).
 * Real = pessoa; Bot = robot; Cloud = IP de servidor.
 */

export type ClickVisitorKind = "real" | "bot" | "datacenter";

export type ClickVisitorQuality = {
  kind: ClickVisitorKind;
  label: string;
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
 * Prioridade: cloud (IP) → bot → real.
 */
export function resolveClickVisitorQuality(e: QualityInput): ClickVisitorQuality {
  if (e.unqualified) {
    const net = (e.ip_network || "").trim();
    const label = net ? `Cloud (${net})` : "Cloud";
    const reason = (e.unqualified_reason || "").trim();
    return {
      kind: "datacenter",
      label,
      detail: reason
        ? reason.replace(/\bDatacenter\b/gi, "Cloud").replace(/\bexclude_from_kpi\b/gi, "fora dos totais")
        : "IP de servidor ou rede cloud (não é um visitante residencial típico). Só afecta o relatório — a página não muda.",
    };
  }
  if (e.is_bot) {
    const bot = (e.bot_label || "").trim();
    const isGoogle =
      /google/i.test(bot) || /adsbot|inspectiontool|googlebot|mediapartners/i.test(bot);
    if (isGoogle) {
      return {
        kind: "bot",
        label: "Robot Google",
        detail:
          "Robot oficial do Google (anúncios ou pesquisa). Não bloqueies este IP — o Google precisa dele.",
      };
    }
    return {
      kind: "bot",
      label: bot ? `Robot (${bot})` : "Robot",
      detail: bot
        ? `Identificado como robot (${bot}).`
        : "Identificado como robot (não é um visitante normal).",
    };
  }
  return {
    kind: "real",
    label: "Real",
    detail: "Parece um visitante normal (sem robot nem IP de servidor conhecido).",
  };
}
