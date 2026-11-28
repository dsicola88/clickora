import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractLegacyOfferCandidate,
  planPresellPrimaryBindingBackfill,
} from "./offerDomainBackfill";

describe("offerDomainBackfill (extração segura sem alterar dados legados)", () => {
  it("extrai oferta e deteta rede a partir de presell legada", () => {
    const out = extractLegacyOfferCandidate({
      title: "Visiflo Review",
      content: { affiliateLink: "https://mwzenith.com/12271/11202/7/?" },
      tracking: { offerUrl: "https://fallback.example/1" },
    });
    assert.ok(out);
    assert.equal(out.hoplinkUrl, "https://mwzenith.com/12271/11202/7/?");
    assert.equal(out.network, "maxweb");
    assert.equal(out.name, "Visiflo Review");
  });

  it("usa tracking.offerUrl quando content.affiliateLink está ausente", () => {
    const out = extractLegacyOfferCandidate({
      title: "Keto Offer",
      content: {},
      tracking: { offerUrl: "https://hop.clickbank.net/?vendor=keto" },
    });
    assert.ok(out);
    assert.equal(out.hoplinkUrl, "https://hop.clickbank.net/?vendor=keto");
    assert.equal(out.network, "clickbank");
  });

  it("ignora placeholder '#' ou URLs inválidas", () => {
    assert.equal(
      extractLegacyOfferCandidate({
        title: "Empty",
        content: { affiliateLink: "#" },
        tracking: { offerUrl: "" },
      }),
      null,
    );
  });

  it("planeia binding primário só a partir de customDomainId explícito (null segue o default da conta)", () => {
    const domains = [
      { id: "d-def", status: "verified", purpose: "both", isDefault: true },
      { id: "d-2", status: "verified", purpose: "hosting", isDefault: false },
      { id: "d-trk", status: "verified", purpose: "tracking", isDefault: false },
    ];
    assert.deepEqual(
      planPresellPrimaryBindingBackfill({
        presellId: "p1",
        customDomainId: "d-2",
        accountDomains: domains,
      }),
      {
        presellId: "p1",
        customDomainId: "d-2",
        role: "primary",
        priority: 10,
        isActive: true,
      },
    );

    assert.equal(
      planPresellPrimaryBindingBackfill({
        presellId: "p2",
        customDomainId: null,
        accountDomains: domains,
      }),
      null,
    );

    assert.equal(
      planPresellPrimaryBindingBackfill({
        presellId: "p2b",
        customDomainId: "d-missing",
        accountDomains: domains,
      }),
      null,
    );

    assert.equal(
      planPresellPrimaryBindingBackfill({
        presellId: "p3",
        customDomainId: "d-trk",
        accountDomains: [domains[2]],
      }),
      null,
    );
  });
});
