import { describe, expect, it } from "vitest";
import {
  applyImportedPolicyToSettings,
  migrateLegacyOperatorUrls,
  resolvePresellFooterPolicies,
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
    expect(bundle.merchant.privacy).toBe("https://v.example/p");
    expect(bundle.merchant.terms).toBe("https://v.example/t");
  });
});
