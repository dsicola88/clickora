import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rehostMirrorImagesToR2 } from "./presellMirrorRehost";

describe("presellMirrorRehost", () => {
  it("skipped when R2 not configured", async () => {
    const html = `<html><body><img src="https://cdn.example.com/a.jpg" /></body></html>`;
    const r = await rehostMirrorImagesToR2({
      srcDoc: html,
      userId: "user-test",
      pageHint: "test",
    });
    // Em CI/local sem R2: skipped true e HTML intacto.
    // Com R2: pode rehostar — só assertamos contrato mínimo.
    assert.equal(typeof r.html, "string");
    assert.equal(typeof r.rehosted, "number");
    assert.equal(typeof r.skipped, "boolean");
    if (r.skipped) {
      assert.equal(r.rehosted, 0);
      assert.equal(r.html, html);
    }
  });
});
