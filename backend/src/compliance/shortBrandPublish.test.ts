import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractPresellSignals, isThinBridgePage } from "./extractPresellSignals";
import { canPublishForAds, evaluateCompliance } from "./evaluate";
import { isGenericImportTitle, classifyPresellImport } from "../lib/presellImportMode";

describe("short brand publish path", () => {
  it("Yusleep is not a generic title", () => {
    assert.equal(isGenericImportTitle("Yusleep"), false);
    assert.equal(isGenericImportTitle("Visivra"), false);
    assert.equal(isGenericImportTitle("Home"), true);
  });

  it("original compact copy + mirror passes Ads gate", () => {
    const sales = `Yusleep

See today's offer.

Before you continue
• You choose after you see the offer.
• The product name and the pictures are ready.
• The current price is on the next page.

On the next page
• The product name and the pictures are ready.
• The current price is on the next page.
• See the current price.

From the offer page
• You choose after you see the offer.
• The current price is on the next page.
• See the current price.

The current price is on the next page.`;
    const signals = extractPresellSignals({
      title: "Yusleep",
      type: "cookies",
      language: "en",
      content: {
        product_name: "Yusleep",
        title: "Yusleep",
        subtitle: "See today's offer.",
        sales_text: sales,
        cta_text: "See the offer",
        images: ["https://cdn.example.com/a.webp", "https://cdn.example.com/b.webp"],
        affiliate_link: "https://offer.example.com/buy",
        source_url: "https://tryyusleep.com/x",
        importMirrorSrcDoc:
          "<article><p>" + "product benefits sleep quality natural formula. ".repeat(80) + "</p></article>",
      },
      settings: {
        cookiePolicyUrl: "/privacidade",
        privacyPolicyUrl: "/privacidade",
        affiliateDisclosure:
          "Divulgação: esta página pode conter links de afiliado. Se comprar através deles, posso receber uma comissão — sem custo extra para si.",
      },
    });
    const dest = {
      attempted: true,
      ok: true,
      https: true,
      statusCode: 200,
      finalUrl: "https://offer.example.com/buy",
      redirectCount: 0,
      redirectCycle: false,
      openRedirectSuspect: false,
      domainChanged: false,
      initialHost: "offer.example.com",
      finalHost: "offer.example.com",
      crawlerBlocked: false,
      hops: ["https://offer.example.com/buy"],
    };
    const ev = evaluateCompliance({ signals, destination: dest });
    assert.equal(isThinBridgePage(signals), false, `thin words=${signals.wordCount}`);
    assert.equal(
      canPublishForAds(ev.gate),
      true,
      `gate=${ev.gate} fails=${ev.results
        .filter((r) => r.status === "FAIL")
        .map((r) => r.ruleId)
        .join(",")}`,
    );
    assert.equal(
      classifyPresellImport({
        mirrorChars: 4000,
        imageCount: 2,
        salesChars: sales.length,
        sourceTextChars: 400,
        title: "Yusleep",
        browser: "rendered",
        hasPrice: true,
        hasSourceCta: true,
      }).publishable,
      true,
    );
  });
});
