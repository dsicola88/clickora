import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isGoogleBudgetEditable,
  parseGoogleBudgetShareFromRow,
  sharedBudgetBlockMessage,
} from "./google-ads-budget";

describe("google-ads-budget", () => {
  it("bloqueia só quando partilhado e reference_count > 1", () => {
    assert.equal(isGoogleBudgetEditable(true, 2), false);
    assert.equal(isGoogleBudgetEditable(true, 1), true);
    assert.equal(isGoogleBudgetEditable(false, 5), true);
  });

  it("parseia linha GAQL camelCase", () => {
    const m = parseGoogleBudgetShareFromRow({
      campaignBudget: {
        explicitlyShared: true,
        referenceCount: "3",
        amountMicros: "15000000",
      },
    });
    assert.equal(m.explicitly_shared, true);
    assert.equal(m.reference_count, 3);
    assert.equal(m.budget_editable, false);
    assert.equal(m.amount_micros, 15_000_000);
  });

  it("mensagem de bloqueio inclui o número de campanhas", () => {
    assert.match(sharedBudgetBlockMessage(4), /4 campanhas/);
  });
});
