import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  apiKeyHasScope,
  normalizeApiKeyScopes,
  scopeRequiredForHttpMethod,
} from "./apiKeyScopes";

describe("apiKeyScopes", () => {
  it("normaliza e deduplica scopes válidos", () => {
    assert.deepEqual(normalizeApiKeyScopes(["read", "write", "read", "admin"]), ["read", "write"]);
    assert.deepEqual(normalizeApiKeyScopes(null), []);
    assert.deepEqual(normalizeApiKeyScopes("read"), []);
  });

  it("write implica read", () => {
    assert.equal(apiKeyHasScope(["write"], "read"), true);
    assert.equal(apiKeyHasScope(["write"], "write"), true);
    assert.equal(apiKeyHasScope(["read"], "write"), false);
    assert.equal(apiKeyHasScope(["read"], "read"), true);
    assert.equal(apiKeyHasScope([], "read"), false);
  });

  it("mapeia método HTTP para scope", () => {
    assert.equal(scopeRequiredForHttpMethod("GET"), "read");
    assert.equal(scopeRequiredForHttpMethod("head"), "read");
    assert.equal(scopeRequiredForHttpMethod("POST"), "write");
    assert.equal(scopeRequiredForHttpMethod("PATCH"), "write");
    assert.equal(scopeRequiredForHttpMethod("DELETE"), "write");
  });
});
