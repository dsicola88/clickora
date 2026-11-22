import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeMirrorEmbedForLiteHtml } from "./sanitizeMirrorEmbedForLiteHtml";

describe("sanitizeMirrorEmbedForLiteHtml", () => {
  it("mantém YouTube iframe e remove tracker", () => {
    const raw = `<html><body>
      <iframe src="https://www.youtube.com/embed/abc"></iframe>
      <iframe src="https://evil.example/pixel"></iframe>
      <p>ok</p>
    </body></html>`;
    const out = sanitizeMirrorEmbedForLiteHtml(raw);
    assert.match(out, /youtube\.com\/embed\/abc/);
    assert.doesNotMatch(out, /evil\.example/);
    assert.match(out, /ok/);
  });
});