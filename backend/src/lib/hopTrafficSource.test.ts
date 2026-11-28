import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hopTrafficSource } from "./hopTrafficSource";

describe("hopTrafficSource", () => {
  it("direct/none sem click ID → sem UTM inventada", () => {
    assert.deepEqual(hopTrafficSource({ source: "direct", medium: "none" }), {
      source: undefined,
      medium: undefined,
      utmSource: undefined,
      utmMedium: undefined,
    });
  });

  it("direct/none com gclid → relatório google / cpc, mas nada inventado para o hoplink", () => {
    assert.deepEqual(hopTrafficSource({ source: "direct", medium: "none", gclid: "Cj0" }), {
      source: "google",
      medium: "cpc",
      utmSource: undefined,
      utmMedium: undefined,
    });
  });

  it("UTMs reais mantêm-se", () => {
    assert.deepEqual(hopTrafficSource({ source: "newsletter", medium: "email", gclid: "Cj0" }), {
      source: "newsletter",
      medium: "email",
      utmSource: "newsletter",
      utmMedium: "email",
    });
  });
});
