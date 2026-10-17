import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  affiliateLinkFromPresellContent,
  isRedirectToAllowedOffer,
} from "./trackOfferRedirectGuard";

describe("trackOfferRedirectGuard", () => {
  it("lê affiliate_link do content", () => {
    assert.equal(
      affiliateLinkFromPresellContent({ affiliate_link: "https://offer.example/buy?hop=1" }),
      "https://offer.example/buy?hop=1",
    );
  });

  it("aceita to igual ao hoplink configurado", () => {
    const offer = "https://www.buygoods.com/secure/checkout.html?account=1";
    assert.equal(isRedirectToAllowedOffer(offer, offer), true);
  });

  it("aceita query extra no to (subs/UTM)", () => {
    const allowed = "https://offer.example/path?hop=abc";
    const to = "https://offer.example/path?hop=abc&sub1=google&utm_source=ads";
    assert.equal(isRedirectToAllowedOffer(to, allowed), true);
  });

  it("aceita www equivalente", () => {
    assert.equal(
      isRedirectToAllowedOffer(
        "https://www.offer.example/go",
        "https://offer.example/go",
      ),
      true,
    );
  });

  it("rejeita open redirect para outro host", () => {
    assert.equal(
      isRedirectToAllowedOffer(
        "https://evil.example/phish",
        "https://offer.example/buy",
      ),
      false,
    );
  });

  it("rejeita path diferente", () => {
    assert.equal(
      isRedirectToAllowedOffer(
        "https://offer.example/other",
        "https://offer.example/buy",
      ),
      false,
    );
  });

  it("rejeita quando query obrigatória da oferta foi alterada", () => {
    assert.equal(
      isRedirectToAllowedOffer(
        "https://offer.example/buy?hop=wrong",
        "https://offer.example/buy?hop=abc",
      ),
      false,
    );
  });
});
