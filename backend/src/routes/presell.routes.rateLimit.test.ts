import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Garante que create/duplicate/status não voltam a partilhar complianceAuditLimiter
 * (regressão do 429 «Demasiadas auditorias» no painel).
 */
describe("presell.routes rate-limit wiring", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "presell.routes.ts"),
    "utf8",
  );

  it("create / duplicate / status usam presellWriteLimiter", () => {
    assert.match(src, /presellRouter\.post\("\/",\s*presellWriteLimiter,\s*presellController\.create\)/);
    assert.match(
      src,
      /presellRouter\.post\("\/:id\/duplicate",\s*presellWriteLimiter,\s*presellController\.duplicate\)/,
    );
    assert.match(
      src,
      /presellRouter\.patch\("\/:id\/status",\s*presellWriteLimiter,\s*presellController\.toggleStatus\)/,
    );
  });

  it("auditorias reais mantêm complianceAuditLimiter", () => {
    assert.match(src, /"\/:id\/compliance\/audit"[\s\S]*?complianceAuditLimiter/);
    assert.match(src, /"\/:id\/analyze-disapproval"[\s\S]*?complianceAuditLimiter/);
  });

  it("create não usa complianceAuditLimiter", () => {
    assert.doesNotMatch(
      src,
      /presellRouter\.post\("\/",\s*complianceAuditLimiter/,
    );
    assert.doesNotMatch(
      src,
      /presellRouter\.patch\("\/:id\/status",\s*complianceAuditLimiter/,
    );
  });
});
