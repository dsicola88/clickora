import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OPTIMIZER_ALERT_SCHEMA_VERSION,
  OPTIMIZER_ALERT_SOURCE,
  type OptimizerWebhookPayload,
} from "./alerts.service";

describe("paid optimizer alerts — contrato email+webhook", () => {
  it("payload de alerta tem schema estável para e-mail paralelo", () => {
    const payload: OptimizerWebhookPayload = {
      source: OPTIMIZER_ALERT_SOURCE,
      schema_version: OPTIMIZER_ALERT_SCHEMA_VERSION,
      event_type: "campaign_paused",
      timestamp: new Date().toISOString(),
      project_id: "00000000-0000-4000-8000-000000000001",
      campaign_id: "00000000-0000-4000-8000-000000000002",
      platform: "google_ads",
      action: "pause_campaign",
      reason: "gasto sem conversão",
      metrics: { spend_usd: 12 },
    };
    assert.equal(payload.source, "clickora.paid.optimizer");
    assert.equal(payload.schema_version, 1);
    assert.ok(payload.project_id);
    assert.equal(payload.event_type, "campaign_paused");
  });
});
