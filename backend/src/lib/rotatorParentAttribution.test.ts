import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rotatorMetaFromParentClick } from "./rotatorParentAttribution";

describe("rotatorParentAttribution", () => {
  it("copies rotator ids from parent click metadata", () => {
    const r = rotatorMetaFromParentClick({
      parentId: "11111111-1111-4111-8111-111111111111",
      parentUserId: "u1",
      ownerUserId: "u1",
      parentMetadata: {
        rotator_id: "22222222-2222-4222-8222-222222222222",
        rotator_arm_id: "33333333-3333-4333-8333-333333333333",
      },
    });
    assert.ok(r);
    assert.equal(r!.parent_rotator_click_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(r!.rotator_id, "22222222-2222-4222-8222-222222222222");
    assert.equal(r!.rotator_arm_id, "33333333-3333-4333-8333-333333333333");
  });

  it("rejects cross-user parent", () => {
    const r = rotatorMetaFromParentClick({
      parentId: "11111111-1111-4111-8111-111111111111",
      parentUserId: "u1",
      ownerUserId: "u2",
      parentMetadata: { rotator_id: "22222222-2222-4222-8222-222222222222" },
    });
    assert.equal(r, null);
  });

  it("rejects parent without rotator_id", () => {
    const r = rotatorMetaFromParentClick({
      parentId: "11111111-1111-4111-8111-111111111111",
      parentUserId: "u1",
      ownerUserId: "u1",
      parentMetadata: { source: "google" },
    });
    assert.equal(r, null);
  });
});
