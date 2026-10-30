import { describe, expect, it } from "vitest";
import {
  buildPublishReadinessFromPresell,
  countUntrackedOfferHrefs,
  publishBlockedByReadiness,
  resolvePresellAffiliateLink,
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

  it("marca domínio pendente quando SSL Vercel ainda a provisionar", () => {
    const items = buildPublishReadinessFromPresell({
      status: "published",
      affiliateLink: "https://mwebkivo.com/1/2/3/",
      mirrorHtml: '<a href="https://x.com/api/track/r/abc?to=offer">Buy</a>',
      customDomainId: "dom-1",
      publicUrl: "https://www.dclickora.com/p/x",
      customDomainHttpsPending: true,
    });
    const domain = items.find((i) => i.id === "domain");
    expect(domain?.ok).toBe(false);
    expect(domain?.hint).toMatch(/SSL/i);
    expect(publishBlockedByReadiness(items)).toBeNull();
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

describe("resolvePresellAffiliateLink", () => {
  it("usa content.affiliateLink e cai para tracking.offerUrl", () => {
    expect(
      resolvePresellAffiliateLink({
        content: { affiliateLink: "https://mwebkivo.com/a/" },
        tracking: { offerUrl: "https://other.example/" },
      }),
    ).toBe("https://mwebkivo.com/a/");
    expect(
      resolvePresellAffiliateLink({
        content: {},
        tracking: { offerUrl: "https://mwebkivo.com/12679/3986/2/?" },
      }),
    ).toBe("https://mwebkivo.com/12679/3986/2/?");
  });
});
