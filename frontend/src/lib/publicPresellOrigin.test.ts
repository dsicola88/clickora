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

  it("Ads URL usa /l/ para review (LCP) e /p/ para cookies", () => {
    const domains = [domain({ id: "www", hostname: "www.x.com", purpose: "hosting", is_default: true })];
    expect(getPublicPresellFullUrl(domains, "www", { id: "a", type: "review" })).toBe(
      "https://www.x.com/l/a",
    );
    expect(getPublicPresellFullUrl(domains, "www", { id: "b", type: "cookies" })).toBe(
      "https://www.x.com/p/b",
    );
  });

  it("usa slug no domínio personalizado (manual /p/)", () => {
    const domains = [domain({ id: "www", hostname: "truefindlab.blog", purpose: "hosting", is_default: true })];
    const url = getPublicPresellFullUrl(domains, "www", {
      id: "11df2eb9-63d3-4d8e-9f99-0e19906bd2f1",
      slug: "trimoryn",
      type: "builder",
    });
    expect(url).toBe("https://truefindlab.blog/p/trimoryn");
  });

  it("mantém UUID em origem dclickora mesmo com slug definido", () => {
    const uuid = "11df2eb9-63d3-4d8e-9f99-0e19906bd2f1";
    const url = getPublicPresellFullUrl(null, null, { id: uuid, slug: "trimoryn", type: "builder" });
    expect(url).toContain(`/p/${uuid}`);
    expect(url).not.toContain("trimoryn");
  });

  it("com SSL pending não grava localhost se houver hostname verificado", () => {
    const domains = [
      domain({
        id: "hv",
        hostname: "honestverdictguide.online",
        purpose: "hosting",
        is_default: true,
        vercel_domain_registered: true,
        https_ready: false,
        ssl_state: "ssl_provisioning",
      }),
    ];
    const url = getPublicPresellFullUrl(domains, "hv", { id: "page-ab", type: "tsl" });
    expect(url).toBe("https://honestverdictguide.online/l/page-ab");
    expect(url).not.toContain("localhost");
  });
});
