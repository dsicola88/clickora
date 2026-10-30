import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapGoogleAdsConnection,
  mapMetaConnection,
  mapTikTokConnection,
} from "./api-mappers";

const baseDates = {
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  lastSyncAt: null as Date | null,
  errorMessage: null as string | null,
};

describe("paid api-mappers — nunca vazam tokens OAuth", () => {
  it("Google: token_ref null; has_token true quando ligado", () => {
    const dto = mapGoogleAdsConnection({
      id: "g1",
      userId: "u1",
      projectId: "p1",
      googleCustomerId: "123",
      accountName: "Conta",
      status: "connected",
      tokenRef: "1//secret-refresh-token-value",
      ...baseDates,
    } as never);
    assert.equal(dto.token_ref, null);
    assert.equal(dto.has_token, true);
    assert.equal(dto.oauth_pending, false);
    assert.ok(!JSON.stringify(dto).includes("secret-refresh"));
  });

  it("Meta: estado OAuth pendente sem has_token", () => {
    const dto = mapMetaConnection({
      id: "m1",
      userId: "u1",
      projectId: "p1",
      adAccountId: null,
      businessId: null,
      accountName: null,
      pageId: null,
      pageName: null,
      status: "pending",
      tokenRef: "state:abc|project:p1",
      ...baseDates,
    } as never);
    assert.equal(dto.token_ref, null);
    assert.equal(dto.has_token, false);
    assert.equal(dto.oauth_pending, true);
  });

  it("TikTok: refresh_token_ref sempre null", () => {
    const dto = mapTikTokConnection({
      id: "t1",
      userId: "u1",
      projectId: "p1",
      advertiserId: "adv",
      accountName: "TT",
      status: "connected",
      tokenRef: "access-secret",
      refreshTokenRef: "refresh-secret",
      ...baseDates,
    } as never);
    assert.equal(dto.token_ref, null);
    assert.equal(dto.refresh_token_ref, null);
    assert.equal(dto.has_token, true);
    assert.equal(dto.has_refresh_token, true);
    assert.ok(!JSON.stringify(dto).includes("access-secret"));
    assert.ok(!JSON.stringify(dto).includes("refresh-secret"));
  });
});
