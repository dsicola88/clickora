import { describe, expect, it } from "vitest";
import {
  defaultAffiliateDisclosureSetting,
  mirrorReferenceNoticeText,
  presellComplianceLanguage,
  publicAffiliateDisclosureText,
} from "./presellPublicComplianceCopy";

describe("presellPublicComplianceCopy", () => {
  it("usa o idioma da presell, não o do visitante, para conformidade", () => {
    expect(presellComplianceLanguage("de", "en")).toBe("de");
    expect(presellComplianceLanguage("pl", "pt-BR")).toBe("pl");
  });

  it("textos de divulgação e espelho no locale pedido", () => {
    const de = presellComplianceLanguage("de");
    expect(publicAffiliateDisclosureText(de)).toMatch(/Provision|Affiliate|unabhängig/i);
    expect(mirrorReferenceNoticeText(de)).toMatch(/Affiliate|Händler/i);
    expect(defaultAffiliateDisclosureSetting("es")).toMatch(/afiliado|comisión/i);
  });
});
