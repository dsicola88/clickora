import { describe, expect, it } from "vitest";
import type { CustomDomainDto } from "@/types/api";
import {
  getPublicPresellFullUrl,
  isHostingCapableDomain,
  listVerifiedHostingDomains,
  resolveDefaultCustomDomainIdForAccount,
} from "./publicPresellOrigin";

function domain(partial: Partial<CustomDomainDto> & Pick<CustomDomainDto, "id" | "hostname">): CustomDomainDto {
  return {
    verification_token: "t",
    status: "verified",
    verified_at: null,
    is_default: false,
    purpose: "both",
    is_default_tracking: false,
    root_presell_id: null,
    vercel_domain_registered: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("publicPresellOrigin hosting vs tracking", () => {
  it("excludes tracking-only from hosting lists", () => {
    expect(isHostingCapableDomain({ purpose: "tracking" })).toBe(false);
    expect(isHostingCapableDomain({ purpose: "both" })).toBe(true);
    const list = listVerifiedHostingDomains([
      domain({ id: "1", hostname: "go.x.com", purpose: "tracking", is_default: true }),
      domain({ id: "2", hostname: "www.x.com", purpose: "hosting" }),
    ]);
    expect(list.map((d) => d.id)).toEqual(["2"]);
  });

  it("default lander ignores tracking-only even if marked is_default", () => {
    const id = resolveDefaultCustomDomainIdForAccount([
      domain({ id: "go", hostname: "go.x.com", purpose: "tracking", is_default: true }),
      domain({ id: "www", hostname: "www.x.com", purpose: "both", is_default: false }),
    ]);
    expect(id).toBe("www");
  });

  it("public URL falls back when presell points at tracking-only domain", () => {
    const url = getPublicPresellFullUrl(
      [
        domain({ id: "go", hostname: "go.x.com", purpose: "tracking" }),
        domain({ id: "www", hostname: "www.x.com", purpose: "hosting", is_default: true }),
      ],
      "go",
      { id: "page-1" },
    );
    expect(url).toBe("https://www.x.com/p/page-1");
  });
});
