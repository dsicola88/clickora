import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keywordResearchByIdWhere, keywordResearchListWhere } from "./keywordResearchScope";

describe("keywordResearchScope", () => {
  it("lista só pelo userId do tenant", () => {
    const where = keywordResearchListWhere("tenant-a");
    assert.deepEqual(where, { userId: "tenant-a" });
    assert.equal("id" in where, false);
  });

  it("leitura por id inclui sempre o tenant", () => {
    const a = keywordResearchByIdWhere("tenant-a", "research-1");
    const b = keywordResearchByIdWhere("tenant-b", "research-1");
    assert.equal(a.id, b.id);
    assert.notEqual(a.userId, b.userId);
    assert.deepEqual(a, { id: "research-1", userId: "tenant-a" });
  });
});
