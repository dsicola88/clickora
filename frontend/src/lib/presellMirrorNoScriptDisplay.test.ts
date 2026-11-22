import { describe, expect, it } from "vitest";
import { unlockMirrorHtmlForSandboxIframe } from "./presellMirrorNoScriptDisplay";

describe("unlockMirrorHtmlForSandboxIframe", () => {
  it("neutraliza .async-hide opacity 0", () => {
    const html = `<!DOCTYPE html><html class="async-hide"><head><style>.async-hide { opacity: 0 !important}</style></head><body><p>Buy</p></body></html>`;
    const out = unlockMirrorHtmlForSandboxIframe(html);
    expect(out).toContain("data-clickora-mirror-unlock");
    expect(out).not.toMatch(/\.async-hide\s*\{\s*opacity:\s*0/i);
    expect(out).toMatch(/<html[^>]*>/i);
    expect(out).not.toMatch(/<html[^>]*async-hide/i);
    expect(out).toContain("<p>Buy</p>");
  });

  it("injeta unlock mesmo sem classe no html", () => {
    const html = "<html><head></head><body>Hello</body></html>";
    expect(unlockMirrorHtmlForSandboxIframe(html)).toContain("data-clickora-mirror-unlock");
  });
});