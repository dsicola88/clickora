import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveGoogleLoginClientId } from "./googleLoginClientId";

describe("resolveGoogleLoginClientId", () => {
  it("prefere GOOGLE_OAUTH_CLIENT_ID", () => {
    assert.equal(
      resolveGoogleLoginClientId({
        GOOGLE_OAUTH_CLIENT_ID: "oauth.apps.googleusercontent.com",
        GOOGLE_ADS_CLIENT_ID: "ads.apps.googleusercontent.com",
      }),
      "oauth.apps.googleusercontent.com",
    );
  });

  it("faz fallback a GOOGLE_ADS_CLIENT_ID", () => {
    assert.equal(
      resolveGoogleLoginClientId({
        GOOGLE_ADS_CLIENT_ID: "ads.apps.googleusercontent.com",
      }),
      "ads.apps.googleusercontent.com",
    );
  });

  it("null sem credenciais", () => {
    assert.equal(resolveGoogleLoginClientId({}), null);
  });
});
