import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { probeDestinationUrl } from "./destinationProbe";

describe("destinationProbe SSRF", () => {
  it("blocks localhost", async () => {
    const r = await probeDestinationUrl("http://127.0.0.1/");
    assert.equal(r.attempted, true);
    assert.equal(r.errorCode, "ssrf_blocked");
    assert.equal(r.ok, false);
  });

  it("blocks metadata endpoint host", async () => {
    const r = await probeDestinationUrl("http://metadata.google.internal/computeMetadata/v1/");
    assert.equal(r.attempted, true);
    assert.equal(r.errorCode, "ssrf_blocked");
  });

  it("blocks link-local metadata IP", async () => {
    const r = await probeDestinationUrl("http://169.254.169.254/latest/meta-data/");
    assert.equal(r.attempted, true);
    assert.equal(r.errorCode, "ssrf_blocked");
  });
});
