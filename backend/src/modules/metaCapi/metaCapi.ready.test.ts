import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encryptSecretField } from "../../lib/fieldEncryption";
import { isMetaCapiReadyForUser } from "./metaCapi.service";

describe("isMetaCapiReadyForUser", () => {
  it("envia com pixel + token mesmo se o toggle legado estiver false", () => {
    const token = encryptSecretField("EAAB-test-token");
    assert.equal(
      isMetaCapiReadyForUser({
        metaCapiEnabled: false,
        metaPixelId: "123456789012345",
        metaAccessToken: token,
      }),
      true,
    );
  });

  it("não envia sem token", () => {
    assert.equal(
      isMetaCapiReadyForUser({
        metaCapiEnabled: true,
        metaPixelId: "123456789012345",
        metaAccessToken: null,
      }),
      false,
    );
  });
});
