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

  it("remove Unsubscribe / opt-out e open-redirect de terceiros; mantém Terms, Privacy, Support e CTA", () => {
    const raw = `<html><body>
      <a href="https://clickora.invalid/__TRACK_OFFER__">Buy Now</a>
      <a href="/terms">Terms</a>
      <a href="https://vendor.example/privacy">Privacy</a>
      <a href="https://support.zendesk.com/hc">Support</a>
      <a href="https://www.redwindowrock.com/o-jlfr-j63-06c48ebf33160ccd043a8bbd3f74d911">Unsubscribe</a>
      <a href="https://evil.example/go?redirect=https://phish.example">More</a>
    </body></html>`;
    const out = sanitizeMirrorEmbedForLiteHtml(raw);
    assert.doesNotMatch(out, /redwindowrock\.com/i);
    assert.doesNotMatch(out, /unsubscribe/i);
    assert.doesNotMatch(out, /evil\.example/i);
    assert.match(out, /__TRACK_OFFER__/);
    assert.match(out, /Terms/);
    assert.match(out, /Privacy/);
    assert.match(out, /Support/);
  });
});