import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapMetaStatus } from "./meta-ads-manager.service";
import { mapTiktokStatus } from "./tiktok-ads-manager.service";
import { isMetaMutationType } from "./meta-ads.mutations";
import { isTiktokMutationType } from "./tiktok-ads.mutations";

describe("mapMetaStatus", () => {
  it("ACTIVE → live", () => assert.equal(mapMetaStatus("ACTIVE"), "live"));
  it("PAUSED → paused", () => assert.equal(mapMetaStatus("PAUSED"), "paused"));
  it("DELETED → archived", () => assert.equal(mapMetaStatus("DELETED"), "archived"));
});

describe("mapTiktokStatus", () => {
  it("ENABLE → live", () => assert.equal(mapTiktokStatus("ENABLE"), "live"));
  it("DISABLE → paused", () => assert.equal(mapTiktokStatus("DISABLE"), "paused"));
});

describe("mutation type guards", () => {
  it("inclui resume Meta/TikTok e publish criativo TikTok", () => {
    assert.equal(isMetaMutationType("meta_resume_entity"), true);
    assert.equal(isMetaMutationType("meta_pause_entity"), true);
    assert.equal(isTiktokMutationType("tiktok_resume_entity"), true);
    assert.equal(isTiktokMutationType("tiktok_pause_entity"), true);
    assert.equal(isTiktokMutationType("tiktok_publish_creative"), true);
    assert.equal(isMetaMutationType("update_budget"), false);
  });
});
