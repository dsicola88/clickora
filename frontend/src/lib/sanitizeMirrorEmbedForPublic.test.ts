import { describe, expect, it } from "vitest";
import { sanitizeMirrorEmbedForPublic } from "./sanitizeMirrorEmbedForPublic";

describe("sanitizeMirrorEmbedForPublic", () => {
  it("remove script e iframe desconhecido; mantém YouTube", () => {
    const raw = `<!DOCTYPE html><html><body>
      <script>bad()</script>
      <iframe src="https://www.youtube.com/embed/x"></iframe>
      <iframe src="https://evil.example/x"></iframe>
      <p>ok</p>
    </body></html>`;
    const out = sanitizeMirrorEmbedForPublic(raw);
    expect(out).not.toMatch(/<script/i);
    expect(out).toMatch(/youtube\.com\/embed\/x/);
    expect(out).not.toMatch(/evil\.example/);
    expect(out).toContain("ok");
  });

  it("remove Unsubscribe/opt-out e preserva Privacy, Terms, Support e checkout", () => {
    const raw = `<!DOCTYPE html><html><body>
      <a href="https://clickora.invalid/__TRACK_OFFER__">Buy Now</a>
      <a href="https://vendor.example/terms">Terms</a>
      <a href="/privacy">Privacy</a>
      <a href="https://support.vendor.example/help">Support</a>
      <a href="https://www.redwindowrock.com/o-jlfr-j63-06c48ebf33160ccd043a8bbd3f74d911">Unsubscribe</a>
    </body></html>`;
    const out = sanitizeMirrorEmbedForPublic(raw);
    expect(out).not.toMatch(/redwindowrock\.com/i);
    expect(out).not.toMatch(/unsubscribe/i);
    expect(out).toContain("Terms");
    expect(out).toContain("/privacy");
    expect(out).toContain("Support");
    expect(out).toContain("__TRACK_OFFER__");
  });
});