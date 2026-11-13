import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractVideoUrl } from "./presellImporter.js";

describe("extractVideoUrl — VSL YouTube + Bunny", () => {
  it("prioriza iframe Bunny mediadelivery e normaliza play → embed", () => {
    const html = `
      <html><body>
        <iframe src="https://video.bunnycdn.com/play/12345/abcdef01-2345-6789-abcd-ef0123456789"></iframe>
        <a href="https://cdn.example.com/noise.mp4">x</a>
      </body></html>`;
    const out = extractVideoUrl(html, "https://offer.example/p");
    assert.equal(
      out,
      "https://iframe.mediadelivery.net/embed/12345/abcdef01-2345-6789-abcd-ef0123456789",
    );
  });

  it("aceita iframe.mediadelivery já em embed", () => {
    const html = `<iframe src="https://iframe.mediadelivery.net/embed/99/vid-uuid-001"></iframe>`;
    const out = extractVideoUrl(html, "https://offer.example/p");
    assert.equal(out, "https://iframe.mediadelivery.net/embed/99/vid-uuid-001");
  });

  it("YouTube watch → embed", () => {
    const html = `<iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></iframe>`;
    const out = extractVideoUrl(html, "https://offer.example/p");
    assert.ok(out && /youtube\.com\/embed\/dQw4w9WgXcQ/i.test(out));
  });

  it("extrai Bunny de script inline", () => {
    const html = `<script>var cfg={url:"https://video.bunnycdn.com/play/7/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"};</script>`;
    const out = extractVideoUrl(html, "https://offer.example/p");
    assert.equal(
      out,
      "https://iframe.mediadelivery.net/embed/7/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
  });

  it("mediadelivery /play → /embed; YouTube nocookie → embed", () => {
    const bunny = extractVideoUrl(
      `<iframe src="https://iframe.mediadelivery.net/play/55/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?autoplay=true"></iframe>`,
      "https://offer.example/p",
    );
    assert.equal(
      bunny,
      "https://iframe.mediadelivery.net/embed/55/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
    const yt = extractVideoUrl(
      `<iframe src="https://www.youtube-nocookie.com/embed/DbVOLSyjP5I"></iframe>`,
      "https://offer.example/p",
    );
    assert.ok(yt && /youtube\.com\/embed\/DbVOLSyjP5I/i.test(yt));
  });
});
