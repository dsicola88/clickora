import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRedirectToAllowedOffer, resolveOfferDestination } from "./offerRedirectGuard.js";

describe("edge offerRedirectGuard", () => {
  it("aceita to= com sub1 extra no mesmo host/path", () => {
    const allowed = "https://www.buygoods.com/x?aff_id=9";
    const to = "https://www.buygoods.com/x?aff_id=9&subid=gate_arm_a";
    assert.equal(isRedirectToAllowedOffer(to, allowed), true);
  });

  it("rejeita to= noutro host", () => {
    assert.equal(
      isRedirectToAllowedOffer("https://evil.example/x?aff_id=9", "https://www.buygoods.com/x?aff_id=9"),
      false,
    );
  });

  it("resolveOfferDestination prefere to= autorizado", () => {
    const cached = "https://www.buygoods.com/x?aff_id=9";
    const to = "https://www.buygoods.com/x?aff_id=9&subid=from_cta";
    const out = resolveOfferDestination(cached, new URLSearchParams({ to }));
    assert.equal(out, to);
  });

  it("resolveOfferDestination cai no cache se to= for open-redirect", () => {
    const cached = "https://www.buygoods.com/x?aff_id=9";
    const out = resolveOfferDestination(
      cached,
      new URLSearchParams({ to: "https://phish.example/steal" }),
    );
    assert.equal(out, cached);
  });
});
