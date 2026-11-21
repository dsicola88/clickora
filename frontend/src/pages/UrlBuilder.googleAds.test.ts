import { describe, expect, it } from "vitest";
import { filterClickIdsFromParamRows } from "./UrlBuilder";
import { cleanPresellUrlForGoogleFinalBase } from "@/lib/googleAdsPresellUrl";

describe("UrlBuilder Google/Bing split", () => {
  it("remove gclid do sufixo", () => {
    const out = filterClickIdsFromParamRows([
      { key: "utm_source", value: "google" },
      { key: "gclid", value: "{gclid}" },
    ]);
    expect(out.map((r) => r.key)).toEqual(["utm_source"]);
  });

  it("base limpa para Final URL", () => {
    const base = "https://x.blog/p/id?utm=1&gclid=abc";
    expect(cleanPresellUrlForGoogleFinalBase(base)).toBe("https://x.blog/p/id");
  });
});