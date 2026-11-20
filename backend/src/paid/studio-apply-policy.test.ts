import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldApplyStudioChangeImmediately } from "./studio-apply-policy";

describe("shouldApplyStudioChangeImmediately", () => {
  it("aplica já em autopilot mesmo se não for o dono", () => {
    assert.equal(
      shouldApplyStudioChangeImmediately({
        paidMode: "autopilot",
        projectOwnerId: "owner",
        requestedById: "member",
      }),
      true,
    );
  });

  it("aplica já em copilot quando o dono pede", () => {
    assert.equal(
      shouldApplyStudioChangeImmediately({
        paidMode: "copilot",
        projectOwnerId: "owner",
        requestedById: "owner",
      }),
      true,
    );
  });

  it("fica pendente em copilot quando outro membro pede", () => {
    assert.equal(
      shouldApplyStudioChangeImmediately({
        paidMode: "copilot",
        projectOwnerId: "owner",
        requestedById: "member",
      }),
      false,
    );
  });
});
