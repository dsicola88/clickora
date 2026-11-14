import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLocalDatabaseForMutations,
  assertSafeHttpTarget,
  databaseHostInfo,
} from "./loadTestSafety";

describe("loadTestSafety", () => {
  it("bloqueia hosts de produção no HTTP", () => {
    assert.throws(() => assertSafeHttpTarget("https://gondola.proxy.rlwy.net", "health_only"));
    assert.throws(() => assertSafeHttpTarget("https://www.dclickora.com", "health_only"));
    assert.throws(() => assertSafeHttpTarget("https://clickora-production.up.railway.app", "health_only"));
    assert.doesNotThrow(() => assertSafeHttpTarget("http://127.0.0.1:3001", "health_only"));
  });

  it("permite só clickora-staging com ALLOW_STAGING_LOAD_TEST=1", () => {
    const prevS = process.env.ALLOW_STAGING_LOAD_TEST;
    const prevM = process.env.ALLOW_MUTATING_LOAD_TEST;
    delete process.env.ALLOW_STAGING_LOAD_TEST;
    assert.throws(() =>
      assertSafeHttpTarget("https://clickora-staging.up.railway.app", "health_only"),
    );
    process.env.ALLOW_STAGING_LOAD_TEST = "1";
    process.env.ALLOW_MUTATING_LOAD_TEST = "1";
    assert.doesNotThrow(() =>
      assertSafeHttpTarget("https://clickora-staging.up.railway.app", "mutating"),
    );
    assert.throws(() =>
      assertSafeHttpTarget("https://clickora-production.up.railway.app", "mutating"),
    );
    if (prevS === undefined) delete process.env.ALLOW_STAGING_LOAD_TEST;
    else process.env.ALLOW_STAGING_LOAD_TEST = prevS;
    if (prevM === undefined) delete process.env.ALLOW_MUTATING_LOAD_TEST;
    else process.env.ALLOW_MUTATING_LOAD_TEST = prevM;
  });

  it("marca Railway como blocked na DATABASE_URL", () => {
    const info = databaseHostInfo("postgresql://u:p@gondola.proxy.rlwy.net:5432/railway");
    assert.equal(info.blocked, true);
    assert.equal(info.isLocal, false);
  });

  it("aceita localhost como BD local", () => {
    const info = databaseHostInfo("postgresql://clickora:clickora@127.0.0.1:5434/clickora");
    assert.equal(info.blocked, false);
    assert.equal(info.isLocal, true);
  });

  it("recusa mutações se DATABASE_URL actual não for local", () => {
    // Depende do ambiente; se Railway estiver no env, deve lançar.
    const info = databaseHostInfo();
    if (info.blocked || !info.isLocal) {
      assert.throws(() => assertLocalDatabaseForMutations());
    }
  });
});
