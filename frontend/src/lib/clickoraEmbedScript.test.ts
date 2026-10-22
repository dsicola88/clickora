import { describe, expect, it } from "vitest";
import { buildClickoraEmbedScriptHtml, stripClickoraEmbedScripts } from "./clickoraEmbedScript";

describe("clickoraEmbedScript", () => {
  it("gera script async no head com data-presell-id", () => {
    const html = buildClickoraEmbedScriptHtml({
      apiBase: "https://example.com/api",
      userId: "user-1",
      presellId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(html).toContain('src="https://example.com/api/track/v2/clickora.min.js"');
    expect(html).toMatch(/\basync\b/);
    expect(html).toContain('data-id="user-1"');
    expect(html).toContain('data-presell-id="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"');
    expect(html.startsWith("<script ")).toBe(true);
  });

  it("remove scripts clickora antigos (incl. localhost)", () => {
    const raw = `<script src="http://localhost:3001/api/track/v2/clickora.min.js" data-id="x"></script>\n\n<!-- meta -->`;
    expect(stripClickoraEmbedScripts(raw)).toBe("<!-- meta -->");
  });
});
