import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDatacenterIp,
  datacenterClickPlace,
  isExplicitDatacenterForAutoBlacklist,
} from "./ipNetworkClass";
import { isProtectedGoogleCrawlerUserAgent } from "./detectBot";

describe("datacenter IP", () => {
  it("152.233.29.1 é CDN77 — explícito para auto-blacklist", () => {
    const net = classifyDatacenterIp("152.233.29.1");
    assert.equal(net?.name, "CDN77");
    assert.equal(isExplicitDatacenterForAutoBlacklist(net), true);
    const place = datacenterClickPlace("::ffff:152.233.29.1");
    assert.equal(place?.unqualified, true);
    assert.equal(place?.auto_blacklist, true);
  });

  it("IPs EC2 Visivra (bootstrap confirmado) são AWS elegíveis", () => {
    for (const ip of ["18.144.100.168", "52.53.177.27", "54.67.110.173"]) {
      const net = classifyDatacenterIp(ip);
      assert.equal(net?.name, "AWS", ip);
      assert.equal(isExplicitDatacenterForAutoBlacklist(net), true, ip);
      assert.equal(datacenterClickPlace(ip)?.auto_blacklist, true, ip);
    }
  });

  it("IP de documentação não é datacenter", () => {
    assert.equal(classifyDatacenterIp("203.0.113.50"), null);
    assert.equal(classifyDatacenterIp("8.8.8.8"), null);
  });
});

describe("crawlers Google protegidos", () => {
  it("AdsBot e Googlebot não devem ser auto-blacklistados", () => {
    assert.equal(
      isProtectedGoogleCrawlerUserAgent(
        "Mozilla/5.0 (compatible; AdsBot-Google; +http://www.google.com/adsbot.html)",
      ),
      true,
    );
    assert.equal(
      isProtectedGoogleCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"),
      true,
    );
    assert.equal(
      isProtectedGoogleCrawlerUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
      false,
    );
  });
});
