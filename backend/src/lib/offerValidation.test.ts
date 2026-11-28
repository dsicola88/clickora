import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateOfferSafety,
  resolveEffectiveOfferForPresell,
  isRedirectAllowedForEffectiveOffer,
} from "./offerValidation";

describe("offerValidation (segurança e conformidade de ofertas)", () => {
  it("aceita hoplink válido de rede afiliada preservando query params", () => {
    const res = validateOfferSafety({
      hoplinkUrl: "https://mwzenith.com/12271/11202/7/?subid=123",
      network: "maxweb",
    });
    assert.equal(res.ok, true);
    assert.equal(res.status, "valid");
    assert.equal(res.issues.length, 0);
  });

  it("rejeita URLs inválidas, esquemas perigosos e credenciais embutidas", () => {
    for (const bad of [
      "",
      "javascript:alert(1)",
      "ftp://example.com/offer",
      "https://user:pass@mwzenith.com/offer",
      "not-a-url",
    ]) {
      const res = validateOfferSafety({ hoplinkUrl: bad });
      assert.equal(res.ok, false, `esperava bloqueio para ${bad}`);
      assert.equal(res.status, "blocked");
    }
  });

  it("bloqueia SSRF (localhost, IPs privados e metadata endpoints)", () => {
    for (const ssrf of [
      "http://127.0.0.1/admin",
      "http://localhost:3000/test",
      "http://169.254.169.254/latest/meta-data",
      "http://10.0.0.5/internal",
    ]) {
      const res = validateOfferSafety({ hoplinkUrl: ssrf });
      assert.equal(res.ok, false, `esperava bloqueio SSRF para ${ssrf}`);
      assert.equal(res.status, "blocked");
      assert.ok(res.issues.some((i) => i.code === "OFFER_SSRF_OR_INVALID_HOST"));
    }
  });

  it("bloqueia URLs de opt-out / unsubscribe de mailers", () => {
    const res = validateOfferSafety({
      hoplinkUrl: "https://www.redwindowrock.com/o-jlfr-j63-06c48ebf33160ccd043a8bbd3f74d911",
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, "blocked");
    assert.ok(res.issues.some((i) => i.code === "OFFER_OPTOUT_URL"));
  });

  it("bloqueia open-redirect suspeito para domínio desconhecido", () => {
    const res = validateOfferSafety({
      hoplinkUrl: "https://bridge.unknown.test/go?redirect=https://evil-phish.example/checkout",
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, "blocked");
    assert.ok(res.issues.some((i) => i.code === "OFFER_OPEN_REDIRECT"));
  });

  it("valida também backupHoplinkUrl se fornecido", () => {
    const res = validateOfferSafety({
      hoplinkUrl: "https://mwzenith.com/12271/11202/7/",
      backupHoplinkUrl: "http://127.0.0.1/bad-backup",
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, "blocked");
  });
});

describe("resolveEffectiveOfferForPresell", () => {
  it("com Offer ligada usa o link gravado na presell e aceita o hoplink da Offer como alternativo", () => {
    const r = resolveEffectiveOfferForPresell({
      offer: {
        id: "offer-1",
        hoplinkUrl: "https://mwzenith.com/new-offer/?",
        backupHoplinkUrl: "https://hop.clickbank.net/?affiliate=abc&vendor=xyz",
        network: "maxweb",
        validationStatus: "valid",
        isActive: true,
      },
      content: { affiliateLink: "https://legacy-old.example/1" },
      tracking: { offerUrl: "https://legacy-old.example/1" },
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      // O CTA já publicado leva `to=<content.affiliateLink>`: tem de continuar autorizado.
      assert.equal(r.destination, "https://legacy-old.example/1");
      assert.deepEqual(r.alternateDestinations, ["https://mwzenith.com/new-offer/?"]);
      assert.equal(r.network, "maxweb");
      assert.equal(r.source, "offer_entity");
      assert.equal(r.offerId, "offer-1");
      assert.equal(
        isRedirectAllowedForEffectiveOffer(
          "https://legacy-old.example/1?gclid=x",
          r.destination,
          r.backupDestination,
          r.alternateDestinations,
        ),
        true,
      );
      assert.equal(
        isRedirectAllowedForEffectiveOffer(
          "https://mwzenith.com/new-offer/?sub1=a",
          r.destination,
          r.backupDestination,
          r.alternateDestinations,
        ),
        true,
      );
    }
  });

  it("com Offer ligada e presell sem link usa o hoplink da Offer", () => {
    const r = resolveEffectiveOfferForPresell({
      offer: {
        id: "offer-1b",
        hoplinkUrl: "https://mwzenith.com/12271/11202/7/",
        network: null,
        validationStatus: "unchecked",
        isActive: true,
      },
      content: {},
      tracking: null,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.destination, "https://mwzenith.com/12271/11202/7/");
      assert.deepEqual(r.alternateDestinations, []);
      assert.equal(r.network, null);
    }
  });

  it("não bloqueia no hop hoplinks já publicados que falhariam a heurística estrita (validação é ao gravar)", () => {
    const legacyWithRedirectParam = "https://track.network.example/click?url=https%3A%2F%2Fother.example%2Fsale";
    const legacy = resolveEffectiveOfferForPresell({
      offer: null,
      content: { affiliateLink: legacyWithRedirectParam },
      tracking: null,
    });
    assert.equal(legacy.ok, true);

    const importedOffer = resolveEffectiveOfferForPresell({
      offer: {
        id: "offer-imported",
        hoplinkUrl: legacyWithRedirectParam,
        validationStatus: "unchecked",
        isActive: true,
      },
      content: { affiliateLink: legacyWithRedirectParam },
      tracking: null,
    });
    assert.equal(importedOffer.ok, true);
  });

  it("bloqueia quando Offer ligada está bloqueada ou inativa (sem vazar destino)", () => {
    const rBlocked = resolveEffectiveOfferForPresell({
      offer: {
        id: "offer-2",
        hoplinkUrl: "https://mwzenith.com/bad/",
        backupHoplinkUrl: null,
        network: "maxweb",
        validationStatus: "blocked",
        isActive: true,
      },
      content: { affiliateLink: "https://mwzenith.com/legacy/" },
      tracking: null,
    });
    assert.equal(rBlocked.ok, false);
    if (!rBlocked.ok) assert.equal(rBlocked.reason, "offer_blocked");

    const rPaused = resolveEffectiveOfferForPresell({
      offer: {
        id: "offer-3",
        hoplinkUrl: "https://mwzenith.com/paused/",
        backupHoplinkUrl: null,
        network: "maxweb",
        validationStatus: "valid",
        isActive: false,
      },
      content: { affiliateLink: "https://mwzenith.com/legacy/" },
      tracking: null,
    });
    assert.equal(rPaused.ok, false);
    if (!rPaused.ok) assert.equal(rPaused.reason, "offer_inactive");
  });

  it("mantém compatibilidade total com presell legada sem offerId", () => {
    const r = resolveEffectiveOfferForPresell({
      offer: null,
      content: { affiliateLink: "https://hop.clickbank.net/?vendor=visiflo" },
      tracking: null,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.destination, "https://hop.clickbank.net/?vendor=visiflo");
      assert.equal(r.source, "legacy_presell");
      assert.equal(r.offerId, null);
      // Rede no hop legado continua a vir da campanha (sem deteção nova que mude parâmetros de saída).
      assert.equal(r.network, null);
    }
    const missing = resolveEffectiveOfferForPresell({ offer: null, content: {}, tracking: null });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.reason, "missing_offer");
  });

  it("isRedirectAllowedForEffectiveOffer aceita hoplink primário ou backup autorizado", () => {
    const primary = "https://mwzenith.com/12271/11202/7/";
    const backup = "https://backup-offer.example/checkout";
    assert.equal(
      isRedirectAllowedForEffectiveOffer("https://mwzenith.com/12271/11202/7/?gclid=abc", primary, backup),
      true,
    );
    assert.equal(
      isRedirectAllowedForEffectiveOffer("https://backup-offer.example/checkout?gclid=abc", primary, backup),
      true,
    );
    assert.equal(
      isRedirectAllowedForEffectiveOffer("https://evil.example/steal", primary, backup),
      false,
    );
  });
});
