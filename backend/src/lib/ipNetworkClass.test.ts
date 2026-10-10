import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyDatacenterIp, datacenterClickPlace } from "./ipNetworkClass";

describe("datacenter IP", () => {
  it("152.233.29.1 é CDN77 em Londres, não um acesso residencial", () => {
    const net = classifyDatacenterIp("152.233.29.1");
    assert.equal(net?.name, "CDN77");
    assert.equal(net?.country, "GB");
    assert.equal(net?.place, "Londres");
    const place = datacenterClickPlace("::ffff:152.233.29.1");
    assert.equal(place?.country, "GB");
    assert.equal(place?.unqualified, true);
    assert.match(place?.unqualified_reason || "", /VPN ou proxy/);
    assert.match(place?.unqualified_reason || "", /não é qualificado/i);
  });

  it("o bloco cobre 152.233.28.0–152.233.29.255 e não o vizinho", () => {
    assert.equal(classifyDatacenterIp("152.233.28.1")?.name, "CDN77");
    assert.equal(classifyDatacenterIp("152.233.29.255")?.name, "CDN77");
    assert.equal(classifyDatacenterIp("152.233.30.1"), null);
    assert.equal(classifyDatacenterIp("8.8.8.8"), null);
    assert.equal(classifyDatacenterIp("203.0.113.50"), null);
  });
});
