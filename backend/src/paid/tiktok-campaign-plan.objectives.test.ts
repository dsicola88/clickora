import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapTiktokObjectiveType } from "./tiktok-campaign-plan";

describe("mapTiktokObjectiveType", () => {
  it("maps known objectives to TikTok API strings", () => {
    assert.equal(mapTiktokObjectiveType("traffic"), "TRAFFIC");
    assert.equal(mapTiktokObjectiveType("video_views"), "VIDEO_VIEWS");
    assert.equal(mapTiktokObjectiveType("leads"), "LEAD_GENERATION");
    assert.equal(mapTiktokObjectiveType("conversions"), "CONVERSIONS");
    assert.equal(mapTiktokObjectiveType("app_installs"), "APP_INSTALL");
    assert.equal(mapTiktokObjectiveType("reach"), "RF_REACH");
  });
});
