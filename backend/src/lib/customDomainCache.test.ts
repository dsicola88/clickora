import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCustomDomainHostMaps } from "./customDomainCache";

describe("buildCustomDomainHostMaps", () => {
  it("alias www/apex nunca sobrescreve o dono do host exato (independente da ordem)", () => {
    const rowsA = [
      { hostname: "www.marca.example", userId: "userB" },
      { hostname: "marca.example", userId: "userA" },
    ];
    for (const rows of [rowsA, [...rowsA].reverse()]) {
      const { hostnameToUserId } = buildCustomDomainHostMaps(rows);
      assert.equal(hostnameToUserId.get("marca.example"), "userA");
      assert.equal(hostnameToUserId.get("www.marca.example"), "userB");
    }
  });

  it("sem registo exato da variante, o alias aponta para o dono e entra nos origins CORS", () => {
    const { hostnameToUserId, origins } = buildCustomDomainHostMaps([{ hostname: "Loja.Example.", userId: "u1" }]);
    assert.equal(hostnameToUserId.get("loja.example"), "u1");
    assert.equal(hostnameToUserId.get("www.loja.example"), "u1");
    assert.ok(origins.has("https://loja.example"));
    assert.ok(origins.has("https://www.loja.example"));
  });
});
