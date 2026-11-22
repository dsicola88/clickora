import { describe, expect, it } from "vitest";
import { trimMirrorTrailingSpacersInHtml } from "./presellMirrorTailTrim";

describe("trimMirrorTrailingSpacersInHtml", () => {
  it("remove wrapper vazio com min-height no fim do body", () => {
    const html = `<!DOCTYPE html><html><head></head><body>
      <main><p>Offer content here with buy now</p></main>
      <div class="min-h-screen" style="min-height:100vh"></div>
    </body></html>`;
    const out = trimMirrorTrailingSpacersInHtml(html);
    expect(out).not.toMatch(/min-h-screen/);
    expect(out).toContain("Offer content");
    expect(out).toContain('data-clickora="mirror-tail"');
  });

  it("mantém footer com links", () => {
    const html = `<!DOCTYPE html><html><body>
      <p>Product</p>
      <footer><a href="/privacy">Privacy</a></footer>
    </body></html>`;
    const out = trimMirrorTrailingSpacersInHtml(html);
    expect(out).toContain("Privacy");
  });
});