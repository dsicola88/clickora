import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

describe("syncFailureAlerts copy", () => {
  it("aponta para Relatórios → Conversões (não Tracking legado)", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/syncFailureAlerts.ts"), "utf8");
    assert.match(src, /resultados\/relatorios\/conversoes/);
    assert.doesNotMatch(src, /Tracking → Relatórios/);
    assert.match(src, /FRONTEND_URL|APP_PUBLIC_URL/);
  });
});
