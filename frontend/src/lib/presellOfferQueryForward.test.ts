import { describe, expect, it } from "vitest";
import {
  buildOfferForwardParamKeys,
  mergeLandingQueryIntoAffiliateUrl,
  parseOfferQueryForwardAllowlist,
} from "./presellOfferQueryForward";

describe("parseOfferQueryForwardAllowlist", () => {
  it("aceita vírgulas e espaços", () => {
    expect(parseOfferQueryForwardAllowlist("foo, bar  baz")).toEqual(["foo", "bar", "baz"]);
  });

  it("ignora tokens inválidos", () => {
    expect(parseOfferQueryForwardAllowlist("ok, bad..key, fine")).toEqual(["ok", "fine"]);
  });
});

describe("buildOfferForwardParamKeys", () => {
  it("inclui sub1-3 e extras sem duplicar", () => {
    const keys = buildOfferForwardParamKeys({
      offerQueryForwardAllowlist: "sub1, txn_id , txn_id, var9",
    });
    expect(keys).toEqual(["sub1", "sub2", "sub3", "txn_id", "var9"]);
  });
});

describe("mergeLandingQueryIntoAffiliateUrl", () => {
  it("copia chave com casing diferente na landing", () => {
    const search = new URLSearchParams("SUB1=abc&Txn_ID=99");
    const out = mergeLandingQueryIntoAffiliateUrl(
      "https://offer.test/buy",
      search,
      ["sub1", "txn_id"],
    );
    const u = new URL(out);
    expect(u.searchParams.get("sub1")).toBe("abc");
    expect(u.searchParams.get("txn_id")).toBe("99");
  });

  it("não sobrepõe query existente no hoplink", () => {
    const search = new URLSearchParams("sub1=from_land");
    const out = mergeLandingQueryIntoAffiliateUrl(
      "https://offer.test/buy?sub1=hoplink",
      search,
      ["sub1", "sub2"],
    );
    expect(new URL(out).searchParams.get("sub1")).toBe("hoplink");
  });
});
