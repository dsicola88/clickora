import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isTiktokMutationType } from "./tiktok-ads.mutations";

describe("tiktok_publish_creative type", () => {
  it("está no guard de mutações TikTok", () => {
    assert.equal(isTiktokMutationType("tiktok_publish_creative"), true);
    assert.equal(isTiktokMutationType("tiktok_resume_entity"), true);
    assert.equal(isTiktokMutationType("meta_pause_entity"), false);
  });
});
