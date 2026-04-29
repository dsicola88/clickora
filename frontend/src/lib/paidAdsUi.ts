/**
 * Textos e formatação do módulo Paid Ads — linguagem de produto (PT).
 */

export const CHANGE_REQUEST_TYPE_LABELS: Record<string, string> = {
  create_campaign: "Google Ads — nova campanha Search",
  update_budget: "Google Ads — alteração de orçamento",
  add_keywords: "Google Ads — novas palavras-chave",
  publish_rsa: "Google Ads — publicar anúncio RSA",
  pause_entity: "Google Ads — pausar elemento",
  meta_create_campaign: "Meta — nova campanha",
  meta_update_budget: "Meta — alteração de orçamento",
  meta_publish_creative: "Meta — publicar criativo",
  meta_pause_entity: "Meta — pausar elemento",
  tiktok_create_campaign: "TikTok — nova campanha",
  tiktok_update_budget: "TikTok — alteração de orçamento",
  tiktok_pause_entity: "TikTok — pausar elemento",
};

export function changeRequestTypeLabel(type: string): string {
  return CHANGE_REQUEST_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

const CHANGE_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado (sem publicar)",
  rejected: "Rejeitado",
  applied: "Aplicado na rede",
  failed: "Falhou na rede",
};

export function changeRequestStatusLabel(status: string): string {
  return CHANGE_REQUEST_STATUS_LABELS[status] ?? status;
}

/** Classes Tailwind para Badge de estado do pedido (outline). */
export function changeRequestStatusBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-500/60 bg-amber-500/10 font-normal text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-50";
    case "approved":
      return "border-sky-500/50 bg-sky-500/10 font-normal text-sky-950 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-50";
    case "applied":
      return "border-emerald-600/50 bg-emerald-500/10 font-normal text-emerald-950 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-50";
    case "rejected":
      return "border-border font-normal text-muted-foreground";
    case "failed":
      return "border-destructive/60 bg-destructive/10 font-normal text-destructive";
    default:
      return "font-normal";
  }
}

export function campaignPlatformLabel(platform: string): string {
  switch (platform) {
    case "google_ads":
      return "Google Ads";
    case "meta_ads":
      return "Meta (Facebook / Instagram)";
    case "tiktok_ads":
      return "TikTok Ads";
    default:
      return platform.replace(/_/g, " ");
  }
}

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending_publish: "Pronto para publicar",
  live: "Activa",
  paused: "Pausada",
  archived: "Arquivada",
  error: "Erro",
};

export function campaignStatusLabel(status: string): string {
  return CAMPAIGN_STATUS_LABELS[status] ?? status;
}

/** Texto curto quando o backend gravou `optimizer_flags` (motor automático). */
export function optimizerFlagsHint(flags: Record<string, unknown> | undefined): string | null {
  if (!flags || typeof flags !== "object") return null;
  const at = flags.creative_swap_recommended_at;
  if (typeof at === "string" && at.length > 0) {
    return "Sugestão automática: rever criativo (CTR baixo)";
  }
  return null;
}

const OPTIMIZER_RULE_LABELS: Record<string, string> = {
  pause_zero_conv_min_spend: "Sem conversões após gasto mínimo",
  ctr_below_threshold: "CTR abaixo do limiar",
  scale_budget_high_roas: "ROAS acima do limiar (escala)",
};

/** Rótulos enterprise para `rule_code` do backend. */
export function optimizerRuleCodeLabel(code: string): string {
  return OPTIMIZER_RULE_LABELS[code] ?? code.replace(/_/g, " ");
}

/** Rótulos para `decision_type` (`pause_campaign`, …). */
export function optimizerDecisionTypeLabel(decisionType: string): string {
  switch (decisionType) {
    case "pause_campaign":
      return "Pausar campanha";
    case "scale_budget":
      return "Escalar orçamento";
    case "flag_creative_swap":
      return "Recomendação de criativo";
    default:
      return decisionType.replace(/_/g, " ");
  }
}

export function optimizerExecutionSummary(args: {
  dry_run: boolean;
  execution_ok: boolean | null;
  executed: boolean;
}): string {
  if (args.dry_run) return "Simulação (dry-run)";
  if (!args.executed) return "—";
  if (args.execution_ok === true) return "Aplicado com sucesso";
  if (args.execution_ok === false) return "Falhou na rede ou sistema";
  return "Estado indeterminado";
}

/** Classes Tailwind para badge de resultado da execução (motor automático). */
export function optimizerExecutionBadgeClass(args: {
  dry_run: boolean;
  execution_ok: boolean | null;
}): string {
  if (args.dry_run) {
    return "border-amber-500/55 bg-amber-500/12 font-normal text-amber-950 dark:border-amber-500/45 dark:bg-amber-500/14 dark:text-amber-50";
  }
  if (args.execution_ok === true) {
    return "border-emerald-600/45 bg-emerald-500/12 font-normal text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/14 dark:text-emerald-50";
  }
  if (args.execution_ok === false) {
    return "border-destructive/55 bg-destructive/12 font-normal text-destructive";
  }
  return "border-border font-normal text-muted-foreground";
}

/** Micros Google (unidade da API) → texto em USD para ecrãs. */
export function formatUsdFromMicros(micros: number): string {
  const usd = micros / 1_000_000;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(usd);
}

function truncateUrl(u: string, max: number): string {
  if (u.length <= max) return u;
  return `${u.slice(0, max - 1)}…`;
}

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => String(x).trim()).filter(Boolean);
  return out.length ? out : null;
}

/** Explicações legíveis para erros habituais da API Google Ads (mensagens já gravadas no pedido). */
export function friendlyGoogleAdsNetworkError(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  const m = message.trim();
  if (/not compatible with the campaign type|setting type is not compatible/i.test(m)) {
    return "O Google recusou opções de segmentação incompatíveis com campanhas Search (foi aplicada uma correcção no servidor — volte a «Aplicar na rede»).";
  }
  if (/invalid\s+argument/i.test(m)) {
    return "O Google Ads devolveu «invalid argument»: confirme liga OAuth, orçamento mínimo e critérios. Se já corrigiu o rascunho, pode tentar de novo.";
  }
  return null;
}

/** `campaign_id` opcional no payload dos pedidos create_campaign / update_* . */
export function changeRequestCampaignIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  return typeof p.campaign_id === "string" ? p.campaign_id : null;
}

/** Extrai linhas legíveis do payload guardado pelo backend (Google / Meta / TikTok). */
export function summarizeChangeRequestPayload(payload: unknown): {
  lines: string[];
  guardrailMessages: string[];
} {
  const lines: string[] = [];
  const guardrailMessages: string[] = [];

  if (!payload || typeof payload !== "object") {
    return { lines, guardrailMessages };
  }

  const p = payload as Record<string, unknown>;

  const landing = (p.landing_url ?? p.landingUrl) as string | undefined;
  if (typeof landing === "string" && landing.trim()) {
    lines.push(`Landing: ${truncateUrl(landing.trim(), 72)}`);
  }

  const micros = p.daily_budget_micros ?? p.dailyBudgetMicros;
  if (typeof micros === "number" && Number.isFinite(micros)) {
    lines.push(`Orçamento diário (referência): ${formatUsdFromMicros(micros)}`);
  }

  const geo = asStringArray(p.geo_targets ?? p.geoTargets);
  if (geo) lines.push(`Países: ${geo.join(", ")}`);

  const langs = asStringArray(p.language_targets ?? p.languageTargets);
  if (langs) lines.push(`Idiomas (Google): ${langs.join(", ")}`);

  const obj = p.objective ?? p.plan;
  if (typeof obj === "string" && obj.trim()) {
    lines.push(`Objectivo / foco: ${obj.slice(0, 120)}${obj.length > 120 ? "…" : ""}`);
  } else if (obj && typeof obj === "object" && obj !== null && "campaign" in obj) {
    const camp = (obj as { campaign?: { name?: string } }).campaign;
    if (camp?.name) lines.push(`Plano: ${camp.name}`);
  }

  const reasons = p.reasons;
  if (Array.isArray(reasons)) {
    for (const r of reasons) {
      if (r && typeof r === "object" && "message" in r && typeof (r as { message?: unknown }).message === "string") {
        guardrailMessages.push((r as { message: string }).message);
      }
    }
  }

  return { lines: lines.slice(0, 8), guardrailMessages };
}
