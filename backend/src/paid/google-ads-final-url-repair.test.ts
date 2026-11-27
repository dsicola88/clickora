import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planFinalUrlRepair } from "./google-ads-final-url-repair.service";

describe("planFinalUrlRepair (P14)", () => {
  it("URL limpa / vazia não é tocada", () => {
    assert.deepEqual(planFinalUrlRepair([]), { kind: "skip", reason: "sem_final_url" });
    assert.deepEqual(planFinalUrlRepair(["https://offer.tenant.com/p/abc"]), { kind: "skip", reason: "ja_limpa" });
  });

  it("remove gclid/ValueTrack mantendo domínio e caminho", () => {
    const plan = planFinalUrlRepair(["https://offer.tenant.com/p/abc?gclid=TEST123&utm_source=google"]);
    assert.equal(plan.kind, "repair");
    if (plan.kind !== "repair") return;
    const before = new URL(plan.before);
    const after = new URL(plan.after);
    assert.equal(after.origin, before.origin);
    assert.equal(after.pathname, before.pathname);
    assert.equal(after.searchParams.has("gclid"), false);
  });

  it("ValueTrack na query também é limpo sem mudar a landing", () => {
    const plan = planFinalUrlRepair(["https://offer.tenant.com/p/abc?kw={keyword}&cid={campaignid}"]);
    if (plan.kind === "repair") {
      assert.equal(new URL(plan.after).pathname, "/p/abc");
      assert.equal(new URL(plan.after).host, "offer.tenant.com");
    } else {
      assert.equal(plan.kind, "error");
    }
  });
});
