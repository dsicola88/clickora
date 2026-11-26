import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeCopyFromSettings, safeVisitorHtml } from "./presellEnterpriseCloak";
import * as cloak from "./presellEnterpriseCloak";

describe("presellEnterpriseCloak (sem cloak de landing)", () => {
  it("não exporta lógica de cloak por país nem payload de página segura", () => {
    const names = Object.keys(cloak);
    assert.equal(names.includes("shouldServeCloakSafePage"), false);
    assert.equal(names.includes("countryOnCloakDenyList"), false);
    assert.equal(names.includes("buildCloakSafePublicPayload"), false);
  });

  it("copy da página de bloqueio do hop usa defaults", () => {
    const copy = safeCopyFromSettings({});
    assert.ok(copy.title.length > 0);
    assert.ok(copy.body.length > 0);
  });

  it("HTML de bloqueio escapa conteúdo e não leva hoplink", () => {
    const html = safeVisitorHtml("<b>x</b>", "a\nb");
    assert.ok(!html.includes("<b>x</b>"));
    assert.ok(html.includes("&lt;b&gt;"));
  });
});
