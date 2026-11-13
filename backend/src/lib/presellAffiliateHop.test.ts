import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  affiliateHopResolveFailedMessage,
  brandFromSalesHostname,
  looksLikeAffiliateHopOnlyUrl,
  looksLikeNonProductImportBody,
  salesOriginFromHopDestination,
  stubHtmlForHopResolvedBrand,
} from "./presellAffiliateHop";
import { suggestProductEnrichmentUrls } from "./presellImporter";

describe("presellAffiliateHop", () => {
  it("reconhece Knownwalk Everflow hop (URL que não gera página de produto)", () => {
    assert.equal(looksLikeAffiliateHopOnlyUrl("https://www.knownwalk.com/2MSQQZ2M/22JQ9DB7/"), true);
    assert.equal(looksLikeAffiliateHopOnlyUrl("https://knownwalk.com/abc12/def34"), true);
  });

  it("não classifica sales pages reais como hop", () => {
    assert.equal(looksLikeAffiliateHopOnlyUrl("https://melaramax.com/"), false);
    assert.equal(looksLikeAffiliateHopOnlyUrl("https://theneotonics.com/text.php?aff_id=1"), false);
    assert.equal(looksLikeAffiliateHopOnlyUrl("https://www.buygoods.com/secure/checkout.html?vid=1"), false);
  });

  it("detecta corpo JSON Everflow / challenge Cloudflare", () => {
    assert.equal(
      looksLikeNonProductImportBody('{"transaction_id":"x","offer_id":68,"everflow":true}', "application/json"),
      true,
    );
    assert.equal(
      looksLikeNonProductImportBody(
        "<html><title>melaramax.com</title><body>Checking the site...</body></html>",
      ),
      true,
    );
    assert.equal(
      looksLikeNonProductImportBody(
        "<html><title>Melara Max</title><body><h1>Buy Now</h1><p>Herbal formula</p></body></html>",
      ),
      false,
    );
  });

  it("enrichment não sugere origin/ para knownwalk", () => {
    const urls = suggestProductEnrichmentUrls(
      "https://www.knownwalk.com/2MSQQZ2M/22JQ9DB7/",
      "<html></html>",
    );
    assert.equal(urls.length, 0);
  });

  it("mensagem de fallback orienta sales page se o hop não resolver", () => {
    const msg = affiliateHopResolveFailedMessage();
    assert.match(msg, /Knownwalk|SmartAdv/i);
    assert.match(msg, /melaramax\.com/i);
  });

  it("detecta página Cloudflare 520", () => {
    assert.equal(
      looksLikeNonProductImportBody(
        "<html><title>melaramax.com | 520: Web server is returning an unknown error</title><body>error code: 520</body></html>",
      ),
      true,
    );
  });

  it("brand e stub a partir do destino do hop", () => {
    assert.equal(brandFromSalesHostname("www.melaramax.com"), "Melaramax");
    assert.equal(
      salesOriginFromHopDestination(
        "https://melaramax.com/?everflow=true&offer_id=68",
      ),
      "https://melaramax.com/",
    );
    const stub = stubHtmlForHopResolvedBrand("Melaramax", "https://melaramax.com/");
    assert.match(stub, /Melaramax/);
    assert.match(stub, /Buy Now/);
  });
});
