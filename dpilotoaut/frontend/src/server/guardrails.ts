// Pure guardrails evaluator. Isomorphic — safe to import from server functions
// and from the browser if we ever want to preview violations client-side.

export interface ProposedCampaign {
  dailyBudgetMicros: number;
  geoTargets: string[];
  /** All keyword texts (lowercased) flowing into the proposal. */
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

export interface GuardrailViolation {
  /** Stable code, useful for telemetry. */
  code:
    | "exceeds_daily_cap"
    | "exceeds_approval_threshold"
    | "country_not_allowed"
    | "blocked_keyword"
    | "missing_guardrails";
  /** Human-readable, PT-BR. Shown in the approvals queue. */
  message: string;
}

export interface GuardrailEvaluation {
  violations: GuardrailViolation[];
  /** True only when there are zero violations AND guardrails exist. */
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
