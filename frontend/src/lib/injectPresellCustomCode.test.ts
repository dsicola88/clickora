import { describe, expect, it } from "vitest";
import { appendHtmlFragment, coerceTrackingSnippetToHtml } from "./injectPresellCustomCode";

describe("appendHtmlFragment", () => {
  it("materializa scripts top-level e nested no DOM", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    appendHtmlFragment(
      `<!-- Meta -->
      <script data-test="top">window.__pix = 1;</script>
      <div class="wrap"><script data-test="nested">window.__pix = 10;</script></div>
      <noscript><img alt="" src="https://www.facebook.com/tr?id=1&ev=PageView" /></noscript>`,
      host,
    );

    const scripts = host.querySelectorAll("script");
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.getAttribute("data-test")).toBe("top");
    expect(scripts[0]?.textContent).toContain("__pix = 1");
    expect(scripts[1]?.getAttribute("data-test")).toBe("nested");
    expect(host.querySelector(".wrap")).toBeTruthy();
    expect(host.querySelector("noscript")?.innerHTML).toContain("facebook.com/tr");
    host.remove();
  });

  it("JS nu via coerce + append vira script executável no DOM", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const html = coerceTrackingSnippetToHtml(`window.__bare = 'ok';`);
    expect(html).toMatch(/^<script>/);
    appendHtmlFragment(html, host);
    expect(host.querySelector("script")?.textContent).toContain("__bare");
    host.remove();
  });
});
