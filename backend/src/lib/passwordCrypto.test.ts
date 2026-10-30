import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  passwordBcryptRounds,
  passwordCryptoBackend,
  passwordCryptoPoolSize,
  verifyPassword,
} from "./passwordCrypto";

describe("passwordCrypto", () => {
  it("mantém rounds >= 12 e escolhe backend", () => {
    assert.ok(passwordBcryptRounds() >= 12);
    assert.ok(["native", "workers", "inprocess"].includes(passwordCryptoBackend()));
  });

  it("hash + verify correcto e incorrecto", async () => {
    const hash = await hashPassword("secret-test-12", passwordBcryptRounds());
    assert.equal(await verifyPassword("secret-test-12", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
  });

  it("compares concorrentes não bloqueiam indefinidamente", async () => {
    const hash = await hashPassword("parallel-pw", passwordBcryptRounds());
    const n = Math.max(2, passwordCryptoPoolSize());
    const t0 = Date.now();
    const results = await Promise.all(
      Array.from({ length: n }, () => verifyPassword("parallel-pw", hash)),
    );
    const elapsed = Date.now() - t0;
    assert.ok(results.every(Boolean));
    // Com workers, n compares em paralelo devem ser ≪ n × custo serial.
    // Em máquinas fracas ainda pode ser alto; limiar generoso só para smoke.
    assert.ok(elapsed < 30_000, `elapsed=${elapsed}`);
  });
});
