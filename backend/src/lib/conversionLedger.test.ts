import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gclidFromConversionRow } from "./conversionLedger";

describe("conversionLedger", () => {
  it("gclidFromConversionRow prefer click metadata", () => {
    assert.equal(
      gclidFromConversionRow({
        metadata: { gclid: "from-conv" },
        click: { metadata: { gclid: "from-click" } },
      }),
      "from-click",
    );
  });

  it("gclidFromConversionRow cai no metadata da Conversion (ads directo)", () => {
    assert.equal(
      gclidFromConversionRow({
        metadata: { gclid: "CjwAdsDirect", postback_origin: "google_ads" },
        click: null,
      }),
      "CjwAdsDirect",
    );
  });

  it("gclidFromConversionRow vazio sem gclid", () => {
    assert.equal(gclidFromConversionRow({ metadata: {}, click: { metadata: {} } }), "");
  });
});
