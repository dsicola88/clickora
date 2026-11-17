import { describe, expect, it } from "vitest";
import {
  applyImportedPolicyToSettings,
  isClickoraOperatorPolicyUrl,
  migrateLegacyOperatorUrls,
  resolvePresellFooterPolicies,
  resolveVisitorCookiePolicyUrl,
} from "./presellFooterPolicies";

describe("presellFooterPolicies", () => {
  it("guarda URLs do comerciante separadas e mantém políticas do operador na mesma origem", () => {
    const next = applyImportedPolicyToSettings(
      { privacyPolicyUrl: "/custom" },
      {
        privacy: "https://vendor.example/privacy",
        terms: "https://vendor.example/terms",
        refund: "https://vendor.example/refund",
      },
    );
    expect(next.privacyPolicyUrl).toBe("/privacidade");
    expect(next.cookiePolicyUrl).toBe("/aviso-cookies");
    expect(next.termsUrl).toBe("/termos");
    expect(next.merchantPrivacyUrl).toBe("https://vendor.example/privacy");
    expect(next.merchantTermsUrl).toBe("https://vendor.example/terms");
    expect(next.merchantRefundUrl).toBe("https://vendor.example/refund");
  });

  it("migra presells antigas que tinham link externo como privacidade principal", () => {
    const next = migrateLegacyOperatorUrls({
      privacyPolicyUrl: "https://vendor.example/privacy",
      termsUrl: "https://vendor.example/terms",
    });
    expect(next.privacyPolicyUrl).toBe("/privacidade");
    expect(next.cookiePolicyUrl).toBe("/aviso-cookies");
    expect(next.merchantPrivacyUrl).toBe("https://vendor.example/privacy");
    expect(next.merchantTermsUrl).toBe("https://vendor.example/terms");
    expect(next.termsUrl).toBe("/termos");
  });

  it("resolve operador + comerciante para o rodapé", () => {
    const bundle = resolvePresellFooterPolicies(
      { merchantPrivacyUrl: "https://v.example/p" },
      { terms: "https://v.example/t" },
    );
    expect(bundle.operator.privacy).toBe("/privacidade");
    expect(bundle.operator.cookies).toBe("/aviso-cookies");
    expect(bundle.merchant.privacy).toBe("https://v.example/p");
    expect(bundle.merchant.terms).toBe("https://v.example/t");
  });

  it("Cookie-Richtlinie não usa merchantPrivacy; fallback /aviso-cookies", () => {
    expect(isClickoraOperatorPolicyUrl("/privacidade")).toBe(true);
    expect(isClickoraOperatorPolicyUrl("https://app.clickora.test/privacidade")).toBe(true);
    expect(isClickoraOperatorPolicyUrl("https://vendor.example/privacy")).toBe(false);

    expect(
      resolveVisitorCookiePolicyUrl(
        { cookiePolicyUrl: "/privacidade", merchantPrivacyUrl: "https://vendor.example/datenschutz" },
        null,
        "de",
      ),
    ).toBe("/aviso-cookies?lang=de");

    expect(
      resolveVisitorCookiePolicyUrl(
        { cookiePolicyUrl: "/privacidade" },
        { privacy: "https://shop.example/privacy" },
        "de",
      ),
    ).toBe("/aviso-cookies?lang=de");

    expect(resolveVisitorCookiePolicyUrl({}, null, "en")).toBe("/aviso-cookies?lang=en");

    expect(
      resolveVisitorCookiePolicyUrl(
        { cookiePolicyUrl: "https://producer.example/cookie-policy" },
        { privacy: "https://producer.example/privacy" },
        "de",
      ),
    ).toBe("https://producer.example/cookie-policy");

    const fromForm = applyImportedPolicyToSettings(
      { cookiePolicyUrl: "https://producer.example/cookies" },
      undefined,
    );
    expect(fromForm.cookiePolicyUrl).toBe("https://producer.example/cookies");
    expect(resolveVisitorCookiePolicyUrl(fromForm, null, "de")).toBe("https://producer.example/cookies");
  });
});
