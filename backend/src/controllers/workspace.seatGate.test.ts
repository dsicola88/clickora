import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { workspaceSeatGate } from "./workspace.controller";

describe("workspaceSeatGate", () => {
  it("bloqueia no tecto; ilimitado passa", () => {
    assert.deepEqual(workspaceSeatGate(5, 4), { ok: true });
    const full = workspaceSeatGate(5, 5);
    assert.equal(full.ok, false);
    if (!full.ok) assert.equal(full.body.code, "WORKSPACE_MEMBER_LIMIT");
    assert.deepEqual(workspaceSeatGate(null, 999), { ok: true });
  });

  it("addMember usa a quota do dono do :workspaceId, não do tenant activo", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "workspace.controller.ts"),
      "utf8",
    );
    assert.match(src, /assertWorkspaceSeatAvailable\(wid, workspace\.ownerUserId\)/);
    assert.doesNotMatch(src, /assertCanAddWorkspaceMember\(billingUserId\(req\)\)/);
  });
});
