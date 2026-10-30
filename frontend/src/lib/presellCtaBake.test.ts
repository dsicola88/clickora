import { describe, expect, it } from "vitest";
import { bakeMirrorOfferHrefsForPresell, trackHrefForPresell } from "@/lib/presellCtaBake";
import { countUntrackedOfferHrefs } from "@/components/PresellPublishReadiness";

describe("presellCtaBake", () => {
  it("trackHrefForPresell aponta para /track/r/:id com to= da oferta", () => {
    const href = trackHrefForPresell(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "https://mwebkivo.com/1/2/3/",
    );
    expect(href).toMatch(/\/track\/r\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee\?/);
    expect(href).toContain("to=");
    expect(decodeURIComponent(href)).toContain("https://mwebkivo.com/1/2/3/");
  });

  it("bake remove hoplinks crus MaxWeb e inclui to=", () => {
    const html = '<a href="https://mwebkivo.com/1/2/3/">Buy</a>';
    const out = bakeMirrorOfferHrefsForPresell(html, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "https://mwebkivo.com/1/2/3/");
    expect(countUntrackedOfferHrefs(out, "https://mwebkivo.com/1/2/3/")).toBe(0);
    expect(out).toMatch(/\/track\/r\//);
    expect(out).toMatch(/to=/);
  });

  it("respeita apiBase absoluto do domínio de tracking", () => {
    const href = trackHrefForPresell(
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "https://offer.example/",
      "https://go.marca.com/api",
    );
    expect(href.startsWith("https://go.marca.com/api/track/r/")).toBe(true);
  });
});
