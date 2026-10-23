import { describe, expect, it } from "vitest";
import { buildEliteQualityBar } from "@/lib/presellEliteQuality";

describe("buildEliteQualityBar", () => {
  it("exige identidade no nicho black", () => {
    const r = buildEliteQualityBar({
      niche: "black",
      affiliateLink: "https://mwebkivo.com/1/",
      mirrorHtml: '<a href="/api/track/r/x">Buy</a>',
      status: "published",
      publicUrl: "https://x.com/p",
      businessName: "",
      contactEmail: "",
      productImagesCount: 3,
      hasAffiliateDisclosure: true,
    });
    expect(r.items.find((i) => i.id === "identity")?.ok).toBe(false);
    expect(r.ready).toBe(false);
  });

  it("passa black com identidade + CTAs", () => {
    const r = buildEliteQualityBar({
      niche: "black",
      affiliateLink: "https://mwebkivo.com/1/",
      mirrorHtml: '<a href="/api/track/r/x">Buy</a>',
      status: "published",
      publicUrl: "https://x.com/p",
      businessName: "João Afiliado",
      contactEmail: "joao@exemplo.com",
      productImagesCount: 3,
      hasAffiliateDisclosure: true,
    });
    expect(r.items.find((i) => i.id === "identity")?.ok).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(85);
  });
});
