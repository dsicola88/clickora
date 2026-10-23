/**
 * Qualidade do visitante no relatório.
 * Real = sem bot (UA) nem IP cloud conhecido; Bot / Datacenter = evidência explícita.
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
 * Prioridade: datacenter (IP) → bot (UA) → real.
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
        "IP em lista explícita de cloud/CDN (AWS/GCP/CDN77). Não é acesso residencial típico.",
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
        ? `User-Agent identificado como bot (${bot}).`
        : "User-Agent identificado como bot.",
    };
  }
  return {
    kind: "real",
    label: "Real",
    detail:
      "Sem bot no User-Agent e sem IP em listas cloud/CDN (AWS/GCP/CDN77). Classificado como visitante real para o relatório.",
  };
}
