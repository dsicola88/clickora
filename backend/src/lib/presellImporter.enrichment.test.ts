import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { suggestProductEnrichmentUrls } from "./presellImporter";

describe("suggestProductEnrichmentUrls", () => {
  it("sugere origem / a partir de text.php com query longa", () => {
    const urls = suggestProductEnrichmentUrls(
      "https://theneotonics.com/text.php?aff_id=1&subid=2&subid2=long_session_token_abc",
      "<html><head><meta property=\"og:url\" content=\"https://theneotonics.com/\"></head></html>",
    );
    assert.ok(urls.includes("https://theneotonics.com/"));
  });

  it("lê canonical e og:url", () => {
    const urls = suggestProductEnrichmentUrls(
      "https://shop.example/go/abc",
      `<html><head>
        <link rel="canonical" href="https://shop.example/product/neotonics">
        <meta property="og:url" content="https://shop.example/product/neotonics">
      </head></html>`,
    );
    assert.ok(urls.some((u) => u.includes("/product/neotonics")));
  });

  it("não devolve a própria URL final", () => {
    const urls = suggestProductEnrichmentUrls(
      "https://shop.example/",
      "<html><meta property=\"og:url\" content=\"https://shop.example/\"></html>",
    );
    assert.equal(urls.includes("https://shop.example/"), false);
  });
});
