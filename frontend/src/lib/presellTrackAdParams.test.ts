import { describe, expect, it } from "vitest";
import {
  buildExportTrackAdParamsBootstrapScript,
  mergeLandingAdParamsIntoTrackHref,
} from "./presellTrackAdParams";

describe("mergeLandingAdParamsIntoTrackHref", () => {
  it("anexa gclid e gad_source sem duplicar ? em URL com to=", () => {
    const track =
      "https://api.example/track/r/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?to=https%3A%2F%2Fbuygoods.com%2Fx%3Faff_id%3D1";
    const out = mergeLandingAdParamsIntoTrackHref(
      track,
      new URLSearchParams("gad_source=1&gclid=teste_google_123&utm_source=Google_Ads"),
    );
    const u = new URL(out);
    expect(u.searchParams.get("gclid")).toBe("teste_google_123");
    expect(u.searchParams.get("gad_source")).toBe("1");
    expect(u.searchParams.get("utm_source")).toBe("Google_Ads");
    expect(u.searchParams.get("to")).toContain("buygoods.com");
    expect(out.indexOf("??")).toBe(-1);
  });

  it("não sobrescreve gclid já no /track/r/", () => {
    const track =
      "https://api.example/track/r/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?gclid=already&to=https%3A%2F%2Fx.test%2F";
    const out = mergeLandingAdParamsIntoTrackHref(
      track,
      new URLSearchParams("gclid=from_page"),
    );
    expect(new URL(out).searchParams.get("gclid")).toBe("already");
  });

  it("ignora macros literais {gclid}", () => {
    const track = "https://api.example/track/r/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const out = mergeLandingAdParamsIntoTrackHref(
      track,
      new URLSearchParams("gclid={gclid}&gad_source=1"),
    );
    const u = new URL(out);
    expect(u.searchParams.get("gclid")).toBeNull();
    expect(u.searchParams.get("gad_source")).toBe("1");
  });

  it("não altera hrefs que não são /track/r/", () => {
    const offer = "https://www.buygoods.com/x?aff_id=1";
    expect(mergeLandingAdParamsIntoTrackHref(offer, "gclid=abc")).toBe(offer);
  });

  it("preserva to= com query de afiliado intacta", () => {
    const to = encodeURIComponent("https://www.digistore24.com/redir/1/2/?cid=keep");
    const track = `https://api.example/track/r/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?to=${to}`;
    const out = mergeLandingAdParamsIntoTrackHref(track, "gclid=Cj0&gad_source=1");
    const u = new URL(out);
    expect(u.searchParams.get("to")).toBe("https://www.digistore24.com/redir/1/2/?cid=keep");
    expect(u.searchParams.get("gclid")).toBe("Cj0");
  });
});

describe("buildExportTrackAdParamsBootstrapScript", () => {
  it("emite script com merge via URLSearchParams", () => {
    const s = buildExportTrackAdParamsBootstrapScript();
    expect(s).toContain("new URL(");
    expect(s).toContain("gclid");
    expect(s).toContain("gad_source");
    expect(s).toContain('a[href*="track/r/"]');
  });
});
