import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("requireDpilotPlan billing tenant", () => {
  it("usa tenantUserId do JWT (workspace activo), não resolveWorkspaceSessionForLogin", () => {
    const src = readFileSync(join(here, "requireDpilotPlan.ts"), "utf8");
    assert.match(src, /auth\.tenantUserId\s*\?\?\s*auth\.userId/);
    assert.doesNotMatch(src, /resolveWorkspaceSessionForLogin/);
  });
});
