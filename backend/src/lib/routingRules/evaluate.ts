import type { RotatorRulesPolicy, RotatorRuleWhen } from "./schema";

export type RuleEvaluationContext = {
  country: string | null;
  device: string;
  now: Date;
  /** Cliques já contados hoje (UTC) para o rotador — opcional para regras de cap global. */
  rotatorClicksTodayUtc?: number;
};

export type PolicyEvalResult =
  | { effect: "continue" }
  | { effect: "block" }
  | { effect: "redirect"; url: string }
  | { effect: "use_backup" };

/**
 * País na condição `when`:
 * - `countries_allow`: o visitante tem de estar na lista (como nos braços do rotador).
 * - só `countries_deny`: a regra aplica-se **quando** o visitante está nessa lista (ex.: bloquear BR).
 * - ambos: tem de estar em allow e não ser excluído por deny (igual ao braço).
 */
function countryMatches(w: RotatorRuleWhen, country: string | null): boolean {
  const allow = w.countries_allow?.length
    ? w.countries_allow.map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;
  const deny = w.countries_deny?.length
    ? w.countries_deny.map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;
  const cc = country?.trim().toUpperCase() || null;

  if (allow && allow.length > 0) {
    if (!cc || !allow.includes(cc)) return false;
    if (deny && deny.length > 0 && deny.includes(cc)) return false;
    return true;
  }
  if (deny && deny.length > 0) {
    if (!cc) return false;
    return deny.includes(cc);
  }
  return true;
}

function deviceMatches(w: RotatorRuleWhen, device: string): boolean {
  const rule = w.device ?? "all";
  if (rule === "all") return true;
  const d = device;
  const isMobileLike = d === "mobile" || d === "tablet";
  if (rule === "mobile") return isMobileLike;
  if (rule === "desktop") return d === "desktop";
  return true;
}

/** Inclusivo nos extremos; se start > end, atravessa meia-noite UTC. */
export function utcHourInWindow(hour: number, start: number, end: number): boolean {
  if (start === end) return hour === start;
  if (start < end) return hour >= start && hour <= end;
  return hour >= start || hour <= end;
}

function timeMatches(w: RotatorRuleWhen, now: Date): boolean {
  if (w.weekdays_utc != null && w.weekdays_utc.length > 0) {
    const wd = now.getUTCDay();
    if (!w.weekdays_utc.includes(wd)) return false;
  }
  if (w.hour_start_utc != null && w.hour_end_utc != null) {
    const h = now.getUTCHours();
    if (!utcHourInWindow(h, w.hour_start_utc, w.hour_end_utc)) return false;
  }
  return true;
}

function capMatches(w: RotatorRuleWhen, ctx: RuleEvaluationContext): boolean {
  const cap = w.max_rotator_clicks_today_utc;
  if (cap == null) return true;
  const n = ctx.rotatorClicksTodayUtc ?? 0;
  return n < cap;
}

export function ruleWhenMatches(when: RotatorRuleWhen, ctx: RuleEvaluationContext): boolean {
  if (!countryMatches(when, ctx.country)) return false;
  if (!deviceMatches(when, ctx.device)) return false;
  if (!timeMatches(when, ctx.now)) return false;
  if (!capMatches(when, ctx)) return false;
  return true;
}

/**
 * Primeira regra cujo `when` coincide aplica-se. Ordem = prioridade.
 * Política vazia ou inválida → continue.
 */
export function evaluateRotatorRulesPolicy(policy: RotatorRulesPolicy | null, ctx: RuleEvaluationContext): PolicyEvalResult {
  if (!policy || !policy.rules?.length) return { effect: "continue" };
  for (const r of policy.rules) {
    if (ruleWhenMatches(r.when, ctx)) {
      switch (r.action.type) {
        case "continue":
          return { effect: "continue" };
        case "block":
          return { effect: "block" };
        case "redirect":
          return { effect: "redirect", url: r.action.url.trim() };
        case "use_backup":
          return { effect: "use_backup" };
        default:
          return { effect: "continue" };
      }
    }
  }
  return { effect: "continue" };
}
