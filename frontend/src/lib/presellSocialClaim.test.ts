import { describe, expect, it } from "vitest";
import { stripStockSocialClaim } from "./presellSocialClaim";

describe("stripStockSocialClaim", () => {
  it("remove a frase modelo e mantém texto real da página", () => {
    expect(stripStockSocialClaim("8 em cada 10 pessoas preferem o nosso produto")).toBe("");
    expect(stripStockSocialClaim("8 out of 10 people prefer our product")).toBe("");
    expect(stripStockSocialClaim("Most buyers mention quieter nights.")).toBe(
      "Most buyers mention quieter nights.",
    );
  });
});
