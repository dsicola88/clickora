import { describe, expect, it } from "vitest";
import { getTrackApiBaseForPublicPresell, normalizeToApiBaseUrl } from "./publicApiUrl";

describe("getTrackApiBaseForPublicPresell", () => {
  it("uses presell host for absolute track base", () => {
    expect(
      getTrackApiBaseForPublicPresell(
        "https://bestbuyhere.sbs/p/84ceef7a-0257-4890-b155-314348347d36",
      ),
    ).toBe("https://bestbuyhere.sbs/api");
  });
});

describe("normalizeToApiBaseUrl", () => {
  it("appends /api to origin", () => {
    expect(normalizeToApiBaseUrl("https://example.com")).toBe("https://example.com/api");
  });
});
