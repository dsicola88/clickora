import { describe, expect, it } from "vitest";
import {
  htmlLooksLikeItHadScripts,
  stripHtmlMarketingExecutors,
} from "./stripHtmlMarketingExecutors";

describe("stripHtmlMarketingExecutors", () => {
  it("remove script, onclick e javascript:", () => {
    const raw = `<html><body>
<script>fbq('init','x')</script>
<img src="a.jpg" onclick="hack()">
<a href="javascript:alert(1)">x</a>
<p>ok</p>
</body></html>`;
    const out = stripHtmlMarketingExecutors(raw);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/fbq/);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain("<p>ok</p>");
    expect(htmlLooksLikeItHadScripts(raw)).toBe(true);
    expect(htmlLooksLikeItHadScripts(out)).toBe(false);
  });
});
