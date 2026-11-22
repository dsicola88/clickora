import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLiteImpressionPixelUrl } from "./buildLiteImpressionPixelUrl";

describe("buildLiteImpressionPixelUrl", () => {
  it("preserva gclid real e ignora macro", () => {
    const url = buildLiteImpressionPixelUrl("https://go.example.com/api", "11111111-1111-4111-8111-111111111111", {
      query: {
        gclid: "RealGclid123",
        utm_source: "google",
      },
      headers: { referer: "https://ads.google.com/" },
    });
    assert.match(url, /\/track\/pixel\/11111111/);
    assert.match(url, /gclid=RealGclid123/);
    assert.match(url, /utm_source=google/);
    assert.doesNotMatch(url, /\{gclid\}/);
  });
});