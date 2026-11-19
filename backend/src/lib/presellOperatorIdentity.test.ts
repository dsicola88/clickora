import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichPresellSettingsWithOperatorIdentity } from "./presellOperatorIdentity";

describe("presellOperatorIdentity", () => {
  it("white preenche productName + e-mail da conta quando rodapé ligado e vazio", () => {
    const { settings, changed } = enrichPresellSettingsWithOperatorIdentity({
      settings: { showAffiliateTrustFooter: true },
      content: { generationNiche: "white", productName: "Neotonics" },
      user: { fullName: "Afiliado Real", email: "pub@example.com", saleNotifyEmail: null },
    });
    assert.equal(changed, true);
    assert.equal(settings.businessName, "Neotonics");
    assert.equal(settings.contactEmail, "pub@example.com");
  });

  it("não preenche identidade com rodapé desligado", () => {
    const { settings, changed } = enrichPresellSettingsWithOperatorIdentity({
      settings: { showAffiliateTrustFooter: false },
      content: { generationNiche: "white", productName: "Neotonics" },
      user: { fullName: "Afiliado Real", email: "pub@example.com", saleNotifyEmail: null },
    });
    assert.equal(changed, false);
    assert.equal(settings.businessName, undefined);
    assert.equal(settings.contactEmail, undefined);
  });

  it("não sobrescreve contacto já definido", () => {
    const { settings, changed } = enrichPresellSettingsWithOperatorIdentity({
      settings: {
        showAffiliateTrustFooter: true,
        businessName: "Marca",
        contactEmail: "keep@example.com",
      },
      content: { generationNiche: "white", productName: "X" },
      user: { email: "other@example.com" },
    });
    assert.equal(changed, false);
    assert.equal(settings.contactEmail, "keep@example.com");
  });
});
