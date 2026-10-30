import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { assertProductionEncryptionKey, encryptSecretField } from "./fieldEncryption";

describe("fieldEncryption production guard", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
    if (prevKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = prevKey;
  });

  it("assertProductionEncryptionKey falha em production sem chave", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENCRYPTION_KEY;
    assert.throws(() => assertProductionEncryptionKey(), /ENCRYPTION_KEY/);
  });

  it("encryptSecretField em production sem chave lança (não plaintext)", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ENCRYPTION_KEY;
    assert.throws(() => encryptSecretField("secret-token"), /ENCRYPTION_KEY|texto claro/);
  });

  it("dev sem chave ainda permite plaintext", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ENCRYPTION_KEY;
    assert.equal(encryptSecretField("secret-token"), "secret-token");
  });
});
