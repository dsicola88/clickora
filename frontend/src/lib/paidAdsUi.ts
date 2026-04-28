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
