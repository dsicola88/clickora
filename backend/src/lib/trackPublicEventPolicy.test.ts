import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isForbiddenPublicTrackEventType } from "./trackPublicEventPolicy";

describe("POST /track/event público", () => {
  it("bloqueia conversion e sale (CORS aberto)", () => {
    assert.equal(isForbiddenPublicTrackEventType("conversion"), true);
    assert.equal(isForbiddenPublicTrackEventType("sale"), true);
  });

  it("permite pageview, impression, lead e click", () => {
    assert.equal(isForbiddenPublicTrackEventType("pageview"), false);
    assert.equal(isForbiddenPublicTrackEventType("impression"), false);
    assert.equal(isForbiddenPublicTrackEventType("lead"), false);
    assert.equal(isForbiddenPublicTrackEventType("click"), false);
  });
});
