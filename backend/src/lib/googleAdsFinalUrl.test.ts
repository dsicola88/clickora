import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hostFromUrl,
  inspectFinalUrl,
  inspectFinalUrlList,
  sanitizeFinalUrlForAds,
} from "./googleAdsFinalUrl";

describe("googleAdsFinalUrl", () => {
  it("hostFromUrl normaliza www", () => {
    assert.equal(hostFromUrl("https://www.Example.com/x"), "example.com");
  });

  it("sanitize remove gclid e ValueTrack e mantém UTM estático", () => {
    const cleaned = sanitizeFinalUrlForAds(
      "https://land.example/p/x?utm_source=google&gclid={gclid}&utm_term={keyword}",
    );
    assert.equal(cleaned, "https://land.example/p/x?utm_source=google");
    assert.deepEqual(inspectFinalUrl(cleaned), []);
  });

  it("detecta gclid e ValueTrack na Final URL", () => {
    const a = inspectFinalUrl("https://land.example/p?gclid={gclid}");
    assert.ok(a.includes("final_url_has_click_id"));
    assert.ok(a.includes("final_url_has_valuetrack"));
  });

  it("detecta ValueTrack no path mesmo com encoding %7B", () => {
    const a = inspectFinalUrl("https://land.example/p/{campaignid}");
    assert.ok(a.includes("final_url_has_valuetrack"));
  });

  it("exige https e host do projecto", () => {
    assert.ok(inspectFinalUrl("http://land.example/x").includes("not_https"));
    assert.ok(inspectFinalUrl("https://other.example/x", "land.example").includes("host_mismatch"));
    assert.deepEqual(inspectFinalUrl("https://land.example/x", "land.example"), []);
  });

  it("lista: múltiplos hosts e URL vazia", () => {
    const empty = inspectFinalUrlList([]);
    assert.deepEqual(empty.issues, ["empty_final_url"]);
    const multi = inspectFinalUrlList(
      ["https://a.example/1", "https://b.example/2"],
      "a.example",
    );
    assert.equal(multi.multiple_distinct_hosts, true);
    assert.ok(multi.issues.includes("host_mismatch"));
  });
});
