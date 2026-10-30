import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  evaluateComplianceQueueAlerts,
  resetOpsAlertCooldownsForTests,
  sendOpsAlert,
  shortOpaqueId,
} from "./opsOperationalAlerts";

describe("opsOperationalAlerts", () => {
  beforeEach(() => {
    resetOpsAlertCooldownsForTests();
    delete process.env.OPS_ALERT_WEBHOOK_URL;
    process.env.OPS_ALERT_BACKLOG_AGE_S = "120";
    process.env.OPS_ALERT_WORKER_OFFLINE_AGE_S = "180";
    process.env.OPS_ALERT_COOLDOWN_MS = "60000";
  });

  it("shortOpaqueId é estável e curto", () => {
    assert.equal(shortOpaqueId("abc"), shortOpaqueId("abc"));
    assert.equal(shortOpaqueId("abc")!.length, 12);
  });

  it("sendOpsAlert sem URL → skipped_no_url", async () => {
    const r = await sendOpsAlert("ops_alert_test", { n: 1 });
    assert.equal(r, "skipped_no_url");
  });

  it("sendOpsAlert entrega e respeita cooldown", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://example.test/hooks";
    const calls: string[] = [];
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(init?.body || ""));
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const a = await sendOpsAlert("ops_alert_test", { probe: 1 }, fetchImpl);
    const b = await sendOpsAlert("ops_alert_test", { probe: 2 }, fetchImpl);
    assert.equal(a, "sent");
    assert.equal(b, "skipped_cooldown");
    assert.equal(calls.length, 1);
    assert.match(calls[0]!, /ops_alert_test/);
    assert.doesNotMatch(calls[0]!, /password|token|Bearer/i);
  });

  it("evaluateComplianceQueueAlerts dispara backlog e worker offline", async () => {
    process.env.OPS_ALERT_WEBHOOK_URL = "https://example.test/hooks";
    const kinds: string[] = [];
    const send = async (kind: string) => {
      kinds.push(kind);
      return "sent" as const;
    };

    await evaluateComplianceQueueAlerts(
      {
        pending: 3,
        processing: 0,
        oldest_pending_age_s: 900,
        failed_24h: 2,
        reconciliation_24h: { needs_attention: true, failed_open_total: 2, open_backlog: 3 },
      },
      send as typeof sendOpsAlert,
    );

    assert.ok(kinds.includes("compliance_queue_backlog"));
    assert.ok(kinds.includes("compliance_jobs_failed"));
    assert.ok(kinds.includes("compliance_worker_offline_suspect"));
  });

  it("não alerta backlog se idade abaixo do limiar", async () => {
    const kinds: string[] = [];
    const send = async (kind: string) => {
      kinds.push(kind);
      return "sent" as const;
    };
    await evaluateComplianceQueueAlerts(
      {
        pending: 5,
        processing: 1,
        oldest_pending_age_s: 30,
        reconciliation_24h: { needs_attention: true, open_backlog: 6 },
      },
      send as typeof sendOpsAlert,
    );
    assert.equal(kinds.includes("compliance_queue_backlog"), false);
  });
});
