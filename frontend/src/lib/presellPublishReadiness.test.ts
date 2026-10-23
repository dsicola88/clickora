import { describe, expect, it } from "vitest";
import { buildPublishReadinessFromPresell } from "@/components/PresellPublishReadiness";

describe("buildPublishReadinessFromPresell", () => {
  it("marca CTAs tracked quando há /api/track/r/", () => {
    const items = buildPublishReadinessFromPresell({
      status: "published",
      affiliateLink: "https://mwebkivo.com/1/2/3/",
      mirrorHtml: '<a href="https://x.com/api/track/r/abc?to=offer">Buy</a>',
      customDomainId: "dom-1",
      publicUrl: "https://offer.example/",
    });
    expect(items.every((i) => i.ok)).toBe(true);
  });

  it("falha publish e offer quando vazios", () => {
    const items = buildPublishReadinessFromPresell({
      status: "draft",
      affiliateLink: "",
      mirrorHtml: "",
    });
    expect(items.find((i) => i.id === "published")?.ok).toBe(false);
    expect(items.find((i) => i.id === "offer")?.ok).toBe(false);
  });
});
