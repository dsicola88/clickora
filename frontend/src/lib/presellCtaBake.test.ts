import { describe, expect, it } from "vitest";
import { bakeMirrorOfferHrefsForPresell, trackHrefForPresell } from "@/lib/presellCtaBake";
import { countUntrackedOfferHrefs } from "@/components/PresellPublishReadiness";

describe("presellCtaBake", () => {
  it("trackHrefForPresell aponta para /track/r/:id", () => {
    expect(trackHrefForPresell("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toMatch(
      /\/track\/r\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee$/,
    );
  });

  it("bake remove hoplinks crus MaxWeb", () => {
    const html = '<a href="https://mwebkivo.com/1/2/3/">Buy</a>';
    const out = bakeMirrorOfferHrefsForPresell(html, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "https://mwebkivo.com/1/2/3/");
    expect(countUntrackedOfferHrefs(out, "https://mwebkivo.com/1/2/3/")).toBe(0);
    expect(out).toMatch(/\/track\/r\//);
  });
});
