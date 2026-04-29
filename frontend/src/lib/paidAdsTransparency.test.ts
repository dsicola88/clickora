import { describe, expect, it } from "vitest";

import {
  approvalQueueTransparencyBullets,
  explainOptimizerDecision,
  suggestedNextAction,
} from "./paidAdsTransparency";
import type { OptimizerDecisionRow } from "@/services/paidAdsService";

function row(partial: Partial<OptimizerDecisionRow>): OptimizerDecisionRow {
  return {
    id: "1",
    project_id: "p",
    campaign_id: "c",
    campaign_name: "Teste",
    platform: "google_ads",
    rule_code: "pause_zero_conv_min_spend",
    decision_type: "pause_campaign",
    dry_run: false,
    input_snapshot: {},
    executed: true,
    execution_ok: true,
    execution_detail: null,
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe("explainOptimizerDecision", () => {
  it("usa reason do snapshot quando existe", () => {
    const ex = explainOptimizerDecision(
      row({
        input_snapshot: { reason: "Motivo explícito do backend." },
      }),
    );
    expect(ex.why).toBe("Motivo explícito do backend.");
    expect(ex.title).toContain("Google");
  });

  it("inclui próxima acção para dry-run", () => {
    const next = suggestedNextAction({
      ruleCode: "any",
      decisionType: "pause_campaign",
      snap: {},
      executionOk: null,
      dryRun: true,
      executed: false,
    });
    expect(next).toContain("dry-run");
  });

  it("scale_budget com ROAS no snapshot refere métrica na próxima acção", () => {
    const next = suggestedNextAction({
      ruleCode: "other",
      decisionType: "scale_budget",
      snap: { roas: 3.2 },
      executionOk: true,
      dryRun: false,
      executed: true,
    });
    expect(next).toMatch(/ROAS/);
    expect(next).toMatch(/3\.20/);
  });
});

describe("approvalQueueTransparencyBullets", () => {
  it("menciona Copilot e confirmação humana", () => {
    const b = approvalQueueTransparencyBullets({ paidMode: "copilot", hasHardGuardrailBlocks: false });
    expect(b.some((x) => /Copilot/i.test(x))).toBe(true);
    expect(b.some((x) => /aprovação|confirm/i.test(x))).toBe(true);
  });

  it("menciona bloqueios quando há guardrails rígidos", () => {
    const b = approvalQueueTransparencyBullets({ paidMode: "autopilot", hasHardGuardrailBlocks: true });
    expect(b.some((x) => /bloqueio|limites/i.test(x))).toBe(true);
  });
});
