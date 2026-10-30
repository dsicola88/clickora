import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isHostingCapablePurpose,
  isTrackingCapablePurpose,
} from "./customDomainPurpose";

describe("customDomainPurpose", () => {
  it("hosting-capable excludes tracking-only", () => {
    assert.equal(isHostingCapablePurpose("tracking"), false);
    assert.equal(isHostingCapablePurpose("hosting"), true);
    assert.equal(isHostingCapablePurpose("both"), true);
    assert.equal(isHostingCapablePurpose(null), true);
  });

  it("tracking-capable includes tracking/both/null", () => {
    assert.equal(isTrackingCapablePurpose("tracking"), true);
    assert.equal(isTrackingCapablePurpose("both"), true);
    assert.equal(isTrackingCapablePurpose(null), true);
    assert.equal(isTrackingCapablePurpose("hosting"), false);
  });
});
