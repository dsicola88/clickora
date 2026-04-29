/**
 * Avaliação de guardrails (portado do dpilotoaut `server/guardrails.ts`).
 * Isolada para o plano de campanha Meta no monólito.
 */

export interface ProposedCampaign {
  dailyBudgetMicros: number;
  geoTargets: string[];
  keywordTexts?: string[];
}

export interface GuardrailLimits {
  max_daily_budget_micros: number;
  max_monthly_spend_micros: number;
  max_cpc_micros: number | null;
  allowed_countries: string[];
  blocked_keywords: string[];
  require_approval_above_micros: number | null;
}

export type GuardrailViolation = {
  code:
    | "exceeds_daily_cap"
    | "exceeds_approval_threshold"
    | "country_not_allowed"
    | "blocked_keyword"
    | "missing_guardrails";
  message: string;
};

export interface GuardrailEvaluation {
  violations: GuardrailViolation[];
  passed: boolean;
}

export function evaluateGuardrails(
  proposal: ProposedCampaign,
  limits: GuardrailLimits | null,
): GuardrailEvaluation {
  const violations: GuardrailViolation[] = [];

  if (!limits) {
    violations.push({
      code: "missing_guardrails",
      message: "Nenhum guardrail configurado para este projeto.",
    });
    return { violations, passed: false };
  }

  if (Number(proposal.dailyBudgetMicros) > Number(limits.max_daily_budget_micros)) {
    violations.push({
      code: "exceeds_daily_cap",
      message: `Orçamento diário ($${(proposal.dailyBudgetMicros / 1_000_000).toFixed(
        2,
      )}) excede o limite ($${(Number(limits.max_daily_budget_micros) / 1_000_000).toFixed(2)}).`,
    });
  }

  if (
    limits.require_approval_above_micros &&
    Number(proposal.dailyBudgetMicros) > Number(limits.require_approval_above_micros)
  ) {
    violations.push({
      code: "exceeds_approval_threshold",
      message: `Mudança acima do limite que exige aprovação manual ($${(
        Number(limits.require_approval_above_micros) / 1_000_000
      ).toFixed(2)}).`,
    });
  }

  const allowed = new Set(limits.allowed_countries.map((c) => c.toUpperCase()));
  const offenders = proposal.geoTargets.map((g) => g.toUpperCase()).filter((g) => !allowed.has(g));
  if (offenders.length) {
    violations.push({
      code: "country_not_allowed",
      message: `País(es) fora da lista permitida: ${offenders.join(", ")}.`,
    });
  }

  const blocked = new Set(limits.blocked_keywords.map((k) => k.toLowerCase()));
  const offendingKws = (proposal.keywordTexts ?? []).filter((t) => blocked.has(t.toLowerCase()));
  if (offendingKws.length) {
    violations.push({
      code: "blocked_keyword",
      message: `Palavra(s)-chave bloqueada(s) detectada(s): ${[...new Set(offendingKws)]
        .slice(0, 5)
        .join(", ")}.`,
    });
  }

  return { violations, passed: violations.length === 0 };
}

/**
 * Mantém apenas códigos de país presentes na lista permitida (ordem original da segmentação).
 * Códigos normalizados em maiúsculas (ISO-3166 alfa-2).
 */
export function intersectGeoTargetsWithAllowedCountries(
  geoTargets: string[],
  allowedCountries: string[],
): string[] {
  const allowed = new Set(allowedCountries.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of geoTargets) {
    const u = String(raw).trim().toUpperCase();
    if (!u || !allowed.has(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/** Vedações que impedem «Aplicar na rede» mesmo após aprovação humana (limite rígido / país / keyword). */
const APPLY_HARD_BLOCK_CODES: GuardrailViolation["code"][] = [
  "exceeds_daily_cap",
  "country_not_allowed",
  "blocked_keyword",
];

function remediationHintForApplyBlock(
  code: GuardrailViolation["code"],
  limits: GuardrailLimits,
  proposal: ProposedCampaign,
): string {
  switch (code) {
    case "exceeds_daily_cap": {
      const capUsd = (Number(limits.max_daily_budget_micros) / 1_000_000).toFixed(2);
      return ` Sugestão automática: definir o orçamento diário em $${capUsd} (igual ao teto actual dos guardrails). Opcionalmente pode usar «Aplicar orçamento sugerido» na fila de aprovações. Como corrigir manualmente: em «Campanhas» edite a campanha de rascunho, ou em «Visão geral» suba «Orçamento máximo diário» nos guardrails.`;
    }
    case "country_not_allowed": {
      const kept = intersectGeoTargetsWithAllowedCountries(proposal.geoTargets, limits.allowed_countries);
      const keptLabel =
        kept.length > 0 ? kept.join(", ") : "nenhum país da segmentação coincide com a lista";
      return ` Sugestão automática: segmentar apenas ${keptLabel}${
        kept.length > 0
          ? ". Opcionalmente use «Aplicar países sugeridos» na fila de aprovações."
          : ". Alargue países permitidos em «Visão geral» ou escolha destinos em «Campanhas»."
      } Como corrigir: em «Campanhas» ajuste países, ou em «Visão geral» alargue a lista permitida.`;
    }
    case "blocked_keyword":
      return " Como corrigir: em «Campanhas», altere ou remova as palavras-chave bloqueadas; ou em «Visão geral» retire-as da lista de bloqueio nos guardrails.";
    default:
      return "";
  }
}

/** Mensagens apenas para violações que devem bloquear a publicação remota (não inclui `exceeds_approval_threshold`). */
export function blockingViolationMessagesForApply(
  limits: GuardrailLimits,
  proposal: ProposedCampaign,
): string[] {
  const { violations } = evaluateGuardrails(proposal, limits);
  return violations
    .filter((v) => APPLY_HARD_BLOCK_CODES.includes(v.code))
    .map((v) => `${v.message.trim()}${remediationHintForApplyBlock(v.code, limits, proposal)}`);
}
