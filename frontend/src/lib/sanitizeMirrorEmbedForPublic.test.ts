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
});