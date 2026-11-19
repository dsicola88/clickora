import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inspectFinalUrl, sanitizeFinalUrlForAds } from "../lib/googleAdsFinalUrl";

/**
 * Contrato do reparo: só conta como aplicado na Google se a URL limpa
 * deixar de ter gclid/ValueTrack — senão o media buyer tem de editar no Ads.
 */
describe("final-url repair contract", () => {
  it("query gclid/ValueTrack limpa → pronta para mutate Google", () => {
    const before = "https://land.example/p/abc?utm_source=google&gclid={gclid}&utm_term={keyword}";
    const after = sanitizeFinalUrlForAds(before);
    assert.equal(after, "https://land.example/p/abc?utm_source=google");
    const issues = inspectFinalUrl(after);
    assert.ok(!issues.includes("final_url_has_click_id"));
    assert.ok(!issues.includes("final_url_has_valuetrack"));
    assert.notEqual(after, before);
  });

  it("ValueTrack no path não fica limpo → exige edição manual no Ads", () => {
    const before = "https://land.example/p/{campaignid}";
    const after = sanitizeFinalUrlForAds(before);
    const afterIssues = inspectFinalUrl(after || before);
    assert.ok(
      afterIssues.includes("final_url_has_valuetrack"),
      "path ValueTrack deve continuar detectado para bloquear falso sucesso",
    );
  });
});
