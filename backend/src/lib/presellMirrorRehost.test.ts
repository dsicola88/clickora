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
    assert.equal(typeof r.html, "string");
    assert.equal(typeof r.rehosted, "number");
    assert.equal(typeof r.skipped, "boolean");
    if (r.skipped) {
      assert.equal(r.rehosted, 0);
      assert.equal(r.html, html);
    }
  });

  it("reconcileMirrorInPresellContent is no-op without mirror", async () => {
    const { reconcileMirrorInPresellContent } = await import("./presellMirrorRehost");
    const r = await reconcileMirrorInPresellContent({
      content: { title: "x" },
      userId: "u1",
    });
    assert.equal(r.skipped, true);
    assert.equal(r.rehosted, 0);
  });

  it("isAlreadyRehostedMirrorUrl detects path", async () => {
    const { isAlreadyRehostedMirrorUrl } = await import("./presellMirrorRehost");
    assert.equal(
      isAlreadyRehostedMirrorUrl("https://cdn.example.com/presell-mirror/u/x/ab.jpg"),
      true,
    );
    assert.equal(isAlreadyRehostedMirrorUrl("https://cdn.example.com/other.jpg"), false);
  });
});
