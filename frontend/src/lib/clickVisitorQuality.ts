/**
 * Qualidade do visitante no relatório — só o que dá para afirmar com evidência.
 * «Pago» (Tipo) ≠ humano; aqui não se inventa.
 */

export type ClickVisitorKind = "sem_alerta" | "bot" | "datacenter";

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
 * Prioridade: datacenter (IP) → bot (UA) → sem alerta.
 * Não usa a palavra «Real» — não há prova biométrica de humano.
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
        "IP em lista explícita de cloud/CDN (AWS/GCP/CDN77). Não é evidência de browser residencial.",
    };
  }
  if (e.is_bot) {
    const bot = (e.bot_label || "").trim();
    const isGoogle =
      /google/i.test(bot) || /adsbot|inspectiontool|googlebot|mediapartners/i.test(bot);
    if (isGoogle) {
      return {
        kind: "bot",
        label: bot ? `Crawler Google (${bot})` : "Crawler Google",
        detail:
          "User-Agent de crawler oficial Google. Não deve ir à blacklist — necessário para anúncios/SEO.",
      };
    }
    return {
      kind: "bot",
      label: bot ? `Bot (${bot})` : "Bot",
      detail: bot
        ? `User-Agent identificado como bot (${bot}). Evidência = UA, não o IP.`
        : "User-Agent identificado como bot.",
    };
  }
  return {
    kind: "sem_alerta",
    label: "Sem alerta",
    detail:
      "Sem bot no User-Agent e sem IP em listas cloud/CDN conhecidas. Não prova que seja um comprador humano.",
  };
}
