import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  builderMediaObjectKey,
  isSafeBuilderMediaFilename,
} from "./presellBuilderMediaUpload";

describe("presellBuilderMediaUpload", () => {
  it("aceita nomes gerados pelo upload", () => {
    assert.equal(isSafeBuilderMediaFilename("a1b2c3d4e5f678901234abcd.jpg"), true);
    assert.equal(isSafeBuilderMediaFilename("ffffffffffffffffffffffff.webp"), true);
    assert.equal(isSafeBuilderMediaFilename("0123456789abcdef01234567.PNG"), true);
  });

  it("rejeita path traversal e nomes inválidos", () => {
    assert.equal(isSafeBuilderMediaFilename("../x.jpg"), false);
    assert.equal(isSafeBuilderMediaFilename("abc.jpg"), false);
    assert.equal(isSafeBuilderMediaFilename("a1b2c3d4e5f678901234abcd.gif"), false);
    assert.equal(isSafeBuilderMediaFilename("a1b2c3d4e5f678901234abcd.jpg.exe"), false);
  });

  it("monta object key R2 estável", () => {
    assert.equal(
      builderMediaObjectKey("user-1", "a1b2c3d4e5f678901234abcd.jpg"),
      "presell-builder/user-1/a1b2c3d4e5f678901234abcd.jpg",
    );
  });
});
