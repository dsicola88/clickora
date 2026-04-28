import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Smoke sem BD: com optimizer desligado o ciclo sai antes de consultar Prisma.
 */
describe("runPaidOptimizerTick", () => {
  it("retorna zero decisões quando PAID_OPTIMIZER_ENABLED≠true", async () => {
    const prevEnabled = process.env.PAID_OPTIMIZER_ENABLED;
    process.env.PAID_OPTIMIZER_ENABLED = "false";

    const { runPaidOptimizerTick } = await import("./optimizer.service");

    const r = await runPaidOptimizerTick();
    assert.equal(r.decisionsLogged, 0);
    assert.equal(r.projectsScanned, 0);
    assert.ok(typeof r.tickId === "string" && r.tickId.length > 10);

    if (prevEnabled === undefined) delete process.env.PAID_OPTIMIZER_ENABLED;
    else process.env.PAID_OPTIMIZER_ENABLED = prevEnabled;
  });
});
