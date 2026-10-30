import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  __resetTrackRateLimitForTests,
  __trackRateLimitConfigForTests,
  consumeTrackRateLimit,
  consumeTrackRateLimitAsync,
} from "./trackRateLimit";

describe("trackRateLimit", () => {
  beforeEach(() => {
    __resetTrackRateLimitForTests();
  });

  it("permite até MAX pedidos e bloqueia o seguinte (memória)", () => {
    const { max } = __trackRateLimitConfigForTests();
    const ip = "203.0.113.50";
    for (let i = 0; i < max; i++) {
      assert.equal(consumeTrackRateLimit(ip), true, `pedido ${i + 1}`);
    }
    assert.equal(consumeTrackRateLimit(ip), false);
  });

  it("async sem REDIS_URL usa a mesma lógica de memória", async () => {
    const { max, hasRedis } = __trackRateLimitConfigForTests();
    assert.equal(hasRedis, false);
    const ip = "203.0.113.51";
    for (let i = 0; i < max; i++) {
      assert.equal(await consumeTrackRateLimitAsync(ip), true);
    }
    assert.equal(await consumeTrackRateLimitAsync(ip), false);
  });

  it("normaliza ::ffff: IPv4-mapped", () => {
    const { max } = __trackRateLimitConfigForTests();
    const a = "198.51.100.10";
    const b = `::ffff:${a}`;
    for (let i = 0; i < max; i++) {
      assert.equal(consumeTrackRateLimit(a), true);
    }
    assert.equal(consumeTrackRateLimit(b), false);
  });
});
