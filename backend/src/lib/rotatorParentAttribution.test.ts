import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fillMissingAdClickIds,
  forwardAdQueryToUrl,
  rotatorMetaFromParentClick,
} from "./rotatorParentAttribution";
import { pickWeightedIndex } from "./rotatorWeights";

describe("rotatorParentAttribution", () => {
  it("copies rotator ids from parent click metadata", () => {
    const r = rotatorMetaFromParentClick({
      parentId: "11111111-1111-4111-8111-111111111111",
      parentUserId: "u1",
      ownerUserId: "u1",
      parentMetadata: {
        rotator_id: "22222222-2222-4222-8222-222222222222",
        rotator_arm_id: "33333333-3333-4333-8333-333333333333",
      },
    });
    assert.ok(r);
    assert.equal(r!.parent_rotator_click_id, "11111111-1111-4111-8111-111111111111");
    assert.equal(r!.rotator_id, "22222222-2222-4222-8222-222222222222");
    assert.equal(r!.rotator_arm_id, "33333333-3333-4333-8333-333333333333");
  });

  it("rejects cross-user parent", () => {
    const r = rotatorMetaFromParentClick({
      parentId: "11111111-1111-4111-8111-111111111111",
      parentUserId: "u1",
      ownerUserId: "u2",
      parentMetadata: { rotator_id: "22222222-2222-4222-8222-222222222222" },
    });
    assert.equal(r, null);
  });

  it("copia o gclid do rotador para o clique da presell quando a lander não o traz", () => {
    const filled = fillMissingAdClickIds(
      { gclid: undefined, msclkid: "bing-real" },
      { gclid: "Cj0KCQreal", gbraid: "{gbraid}", rotator_id: "22222222-2222-4222-8222-222222222222" },
    );
    assert.equal(filled.gclid, "Cj0KCQreal");
    assert.equal(filled.msclkid, "bing-real");
    assert.equal(filled.gbraid, undefined);
  });

  it("leva o gclid do anúncio para o URL da presell", () => {
    const url = forwardAdQueryToUrl("https://loja.example/p/abc", {
      gclid: "Cj0KCQreal",
      utm_source: "google_ads",
      utm_term: "{keyword}",
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("gclid"), "Cj0KCQreal");
    assert.equal(parsed.searchParams.get("utm_source"), "google_ads");
    assert.equal(parsed.searchParams.get("utm_term"), null);
  });

  it("rejects parent without rotator_id", () => {
    const r = rotatorMetaFromParentClick({
      parentId: "11111111-1111-4111-8111-111111111111",
      parentUserId: "u1",
      ownerUserId: "u1",
      parentMetadata: { source: "google" },
    });
    assert.equal(r, null);
  });
});

describe("pesos do rotador", () => {
  it("mantém a proporção 50/50 e 90/10", () => {
    assert.equal(pickWeightedIndex([50, 50], 0), 0);
    assert.equal(pickWeightedIndex([50, 50], 0.49), 0);
    assert.equal(pickWeightedIndex([50, 50], 0.5), 0);
    assert.equal(pickWeightedIndex([50, 50], 0.51), 1);
    assert.equal(pickWeightedIndex([90, 10], 0.9), 0);
    assert.equal(pickWeightedIndex([90, 10], 0.91), 1);
    assert.equal(pickWeightedIndex([0, 100], 0.1), 1);
  });
});
