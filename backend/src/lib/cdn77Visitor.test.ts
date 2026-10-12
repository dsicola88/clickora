import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import { shouldServeCloakSafePage } from "./presellEnterpriseCloak";
import {
  cdn77VisitorCountryFromHeaders,
  isCdn77EdgeIp,
  locationForStoredClick,
  resolveVisitorCountry,
} from "./cdn77Visitor";

function req(headers: Record<string, string>, remote: string): Request {
  return { headers, socket: { remoteAddress: remote } } as unknown as Request;
}

describe("CDN77 visitor country", () => {
  it("reconhece os nós que apareceram no relatório", () => {
    assert.equal(isCdn77EdgeIp("79.127.178.81"), true);
    assert.equal(isCdn77EdgeIp("46.151.194.130"), true);
    assert.equal(isCdn77EdgeIp("84.17.44.227"), true);
    assert.equal(isCdn77EdgeIp("::ffff:152.233.29.1"), true);
    assert.equal(isCdn77EdgeIp("8.8.8.8"), false);
    assert.equal(isCdn77EdgeIp("41.223.10.20"), false);
  });

  it("país do visitante só quando o IP é nó CDN77", () => {
    assert.equal(
      cdn77VisitorCountryFromHeaders({ "x-client-geo-country": "ao" }, "79.127.178.81"),
      "AO",
    );
    assert.equal(
      cdn77VisitorCountryFromHeaders({ "x-client-geo-country": "AO" }, "8.8.8.8"),
      null,
    );
    assert.equal(cdn77VisitorCountryFromHeaders({ "x-client-geo-country": "XX" }, "79.127.178.81"), null);
    assert.equal(cdn77VisitorCountryFromHeaders({}, "79.127.178.81"), null);
  });

  it("não usa a base geográfica do nó", () => {
    const paris = resolveVisitorCountry({ "x-client-geo-country": "AO" }, "79.127.178.81");
    assert.deepEqual(paris, { country: "AO", source: "cdn77" });
    const bare = resolveVisitorCountry({}, "46.151.194.130");
    assert.deepEqual(bare, { country: null, source: "none" });
    const home = resolveVisitorCountry({ "x-client-geo-country": "AO" }, "8.8.8.8");
    assert.equal(home.source, "geoip");
    assert.notEqual(home.country, "AO");
  });

  it("relatório não mostra CZ, UA nem cidade inventada para o nó", () => {
    const wrong = locationForStoredClick({
      ip: "79.127.178.81",
      storedCountry: "CZ",
      countrySource: null,
      datacenter: null,
      geo: { country_code: "CZ", region: "10", city: "Prague" },
    });
    assert.deepEqual(wrong, { country: null, region: null, city: null });

    const sao = locationForStoredClick({
      ip: "46.151.194.130",
      storedCountry: "UA",
      countrySource: null,
      datacenter: null,
      geo: { country_code: "UA", region: "51", city: "Odesa" },
    });
    assert.deepEqual(sao, { country: null, region: null, city: null });

    const angola = locationForStoredClick({
      ip: "79.127.178.81",
      storedCountry: "AO",
      countrySource: "cdn77",
      datacenter: { country: "FR", region: "Paris" },
      geo: { country_code: "CZ", region: "10", city: "Prague" },
    });
    assert.deepEqual(angola, { country: "AO", region: null, city: null });
  });

  it("o bloco de Londres sem visitante continua com o sítio do registo", () => {
    const london = locationForStoredClick({
      ip: "152.233.29.1",
      storedCountry: "GB",
      countrySource: null,
      datacenter: { country: "GB", region: "Londres" },
      geo: { country_code: "BR", region: "SP", city: "Sao Paulo" },
    });
    assert.deepEqual(london, { country: "GB", region: "Londres", city: null });
  });

  it("cloak usa o país do visitante, não o do nó", () => {
    const settings = { enterpriseCloak: true, cloakGeoDeny: "AO" };
    const viaCdn = shouldServeCloakSafePage(
      req({ "x-forwarded-for": "79.127.178.81", "x-client-geo-country": "AO", "user-agent": "Mozilla/5.0" }, "10.0.0.1"),
      settings,
    );
    assert.equal(viaCdn.cloak, true);
    const spoof = shouldServeCloakSafePage(
      req({ "x-forwarded-for": "8.8.8.8", "x-client-geo-country": "AO", "user-agent": "Mozilla/5.0" }, "8.8.8.8"),
      settings,
    );
    assert.equal(spoof.cloak, false);
  });
});
