import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Lógica pura espelhada do gate (sem DB): used + requested vs max.
 * O helper real cobre DB; aqui fixamos a regra comercial.
 */
function wouldExceed(maxPages: number | null, used: number, requested: number): boolean {
  if (maxPages == null) return false;
  return used + requested > maxPages;
}

describe("presell page limit rule", () => {
  it("ilimitado nunca excede", () => {
    assert.equal(wouldExceed(null, 999, 10), false);
  });

  it("create único no limite exacto falha", () => {
    assert.equal(wouldExceed(3, 3, 1), true);
    assert.equal(wouldExceed(3, 2, 1), false);
  });

  it("variant pack (2 páginas) respeita espaço restante", () => {
    assert.equal(wouldExceed(3, 2, 2), true);
    assert.equal(wouldExceed(3, 1, 2), false);
    assert.equal(wouldExceed(25, 24, 2), true);
  });
});
