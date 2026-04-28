/**
 * Alertas assíncronos do Paid Optimizer — webhook JSON (Slack / Zapier / email via middleware).
 * Nunca bloqueia o ciclo; falhas de rede ficam só em log estruturado.
 */
import {
  optimizerAlertFormat,
  optimizerAlertWebhookTimeoutMs,
  optimizerAlertWebhookUrl,
} from "./config";
import { optimizerLog } from "./logger";

export const OPTIMIZER_ALERT_SOURCE = "clickora.paid.optimizer" as const;
export const OPTIMIZER_ALERT_SCHEMA_VERSION = 1 as const;

export type OptimizerAlertEventType = "campaign_paused" | "budget_scaled" | "optimizer_critical_error";

export type OptimizerWebhookPayload = {
  source: typeof OPTIMIZER_ALERT_SOURCE;
  schema_version: typeof OPTIMIZER_ALERT_SCHEMA_VERSION;
  event_type: OptimizerAlertEventType;
  timestamp: string;
  tick_id?: string;
  project_id?: string;
  campaign_id?: string;
  platform?: string;
  /** Verbo curto para filtros (ex.: pause_campaign, scale_budget). */
  action: string;
  reason?: string;
  metrics?: Record<string, unknown>;
  execution_detail?: string;
};

/** Formato legado Slack Incoming Webhook — só campo `text` (mrkdwn). */
function buildSlackIncomingBody(payload: OptimizerWebhookPayload): string {
  const lines: string[] = [];
  lines.push(`*Clickora Paid Optimizer* · \`${payload.event_type}\``);
  lines.push(`*Quando:* ${payload.timestamp}`);
  if (payload.tick_id) lines.push(`*Tick:* \`${payload.tick_id}\``);
  if (payload.project_id) lines.push(`*Projecto:* \`${payload.project_id}\``);
  if (payload.campaign_id) lines.push(`*Campanha:* \`${payload.campaign_id}\``);
  if (payload.platform) lines.push(`*Plataforma:* ${payload.platform}`);
  lines.push(`*Acção:* ${payload.action}`);
  if (payload.reason) lines.push(`*Motivo:* ${payload.reason}`);
  if (payload.metrics && Object.keys(payload.metrics).length > 0) {
    lines.push(`*Métricas:*`);
    lines.push("```");
    lines.push(JSON.stringify(payload.metrics, null, 2).slice(0, 3500));
    lines.push("```");
  }
  if (payload.execution_detail) {
    lines.push("*Detalhe:*");
    lines.push("```");
    lines.push(payload.execution_detail.slice(0, 3500));
    lines.push("```");
  }
  const text = lines.join("\n").slice(0, 39000);
  return JSON.stringify({ text });
}

function serializeAlertBody(payload: OptimizerWebhookPayload): string {
  return optimizerAlertFormat() === "slack_text" ? buildSlackIncomingBody(payload) : JSON.stringify(payload);
}

async function postWebhook(url: string, payload: OptimizerWebhookPayload): Promise<void> {
  const ms = optimizerAlertWebhookTimeoutMs();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: serializeAlertBody(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${txt.slice(0, 400)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Enfileira envio HTTP sem bloquear; erros apenas em log `alert_webhook_delivery_failed`. */
export function enqueueOptimizerAlert(payload: OptimizerWebhookPayload): void {
  const url = optimizerAlertWebhookUrl();
  if (!url) return;

  void postWebhook(url, payload).catch((e: unknown) => {
    optimizerLog("warn", "alert_webhook_delivery_failed", {
      event_type: payload.event_type,
      campaign_id: payload.campaign_id,
      tick_id: payload.tick_id,
      error: e instanceof Error ? e.message : String(e),
    });
  });
}

export function enqueueCampaignPausedAlert(args: {
  tickId: string;
  projectId: string;
  campaignId: string;
  platform: string;
  reason: string;
  metrics: Record<string, unknown>;
}): void {
  enqueueOptimizerAlert({
    source: OPTIMIZER_ALERT_SOURCE,
    schema_version: OPTIMIZER_ALERT_SCHEMA_VERSION,
    event_type: "campaign_paused",
    timestamp: new Date().toISOString(),
    tick_id: args.tickId,
    project_id: args.projectId,
    campaign_id: args.campaignId,
    platform: args.platform,
    action: "pause_campaign",
    reason: args.reason,
    metrics: args.metrics,
  });
}

export function enqueueBudgetScaledAlert(args: {
  tickId: string;
  projectId: string;
  campaignId: string;
  platform: string;
  reason: string;
  metrics: Record<string, unknown>;
}): void {
  enqueueOptimizerAlert({
    source: OPTIMIZER_ALERT_SOURCE,
    schema_version: OPTIMIZER_ALERT_SCHEMA_VERSION,
    event_type: "budget_scaled",
    timestamp: new Date().toISOString(),
    tick_id: args.tickId,
    project_id: args.projectId,
    campaign_id: args.campaignId,
    platform: args.platform,
    action: "scale_budget",
    reason: args.reason,
    metrics: args.metrics,
  });
}

export function enqueueOptimizerCriticalAlert(args: {
  tickId?: string;
  projectId?: string;
  campaignId?: string;
  platform?: string;
  action?: string;
  reason?: string;
  execution_detail?: string;
  metrics?: Record<string, unknown>;
}): void {
  enqueueOptimizerAlert({
    source: OPTIMIZER_ALERT_SOURCE,
    schema_version: OPTIMIZER_ALERT_SCHEMA_VERSION,
    event_type: "optimizer_critical_error",
    timestamp: new Date().toISOString(),
    tick_id: args.tickId,
    project_id: args.projectId,
    campaign_id: args.campaignId,
    platform: args.platform,
    action: args.action ?? "optimizer_critical_error",
    reason: args.reason,
    execution_detail: args.execution_detail,
    metrics: args.metrics ?? {},
  });
}
