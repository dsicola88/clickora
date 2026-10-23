import { describe, expect, it } from "vitest";
import {
  buildPublishReadinessFromPresell,
  countUntrackedOfferHrefs,
  publishBlockedByReadiness,
} from "@/components/PresellPublishReadiness";

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

  it("falha quando há hoplink cru no HTML", () => {
    const items = buildPublishReadinessFromPresell({
      status: "published",
      affiliateLink: "https://mwebkivo.com/1/2/3/",
      mirrorHtml: '<a href="https://mwebkivo.com/1/2/3/">Buy</a>',
      customDomainId: "dom-1",
      publicUrl: "https://offer.example/",
    });
    expect(items.find((i) => i.id === "cta_track")?.ok).toBe(false);
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

describe("countUntrackedOfferHrefs", () => {
  it("conta oferta directa e ignora track", () => {
    const html =
      '<a href="https://mwebkivo.com/offer/">Buy</a><a href="/api/track/r/abc">OK</a>';
    expect(countUntrackedOfferHrefs(html, "https://mwebkivo.com/offer/")).toBe(1);
  });
});

describe("publishBlockedByReadiness", () => {
  it("bloqueia oferta/CTA e ignora domain", () => {
    const items = buildPublishReadinessFromPresell({
      status: "published",
      affiliateLink: "",
      mirrorHtml: "",
    });
    expect(publishBlockedByReadiness(items)?.id).toBe("offer");
  });
});
