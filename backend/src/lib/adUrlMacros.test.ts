import assert from "node:assert/strict";
import test from "node:test";
import { isUnreplacedAdMacro, normalizeUtmDimension } from "./adUrlMacros";

test("isUnreplacedAdMacro detecta ValueTrack literal e %7B…%7D", () => {
  assert.equal(isUnreplacedAdMacro("{keyword}"), true);
  assert.equal(isUnreplacedAdMacro("{creative}"), true);
  assert.equal(isUnreplacedAdMacro("%7Bkeyword%7D"), true);
  assert.equal(isUnreplacedAdMacro("neotonics"), false);
});

test("normalizeUtmDimension descarta macros", () => {
  assert.equal(normalizeUtmDimension("{keyword}"), null);
  assert.equal(normalizeUtmDimension("neotonics"), "neotonics");
  assert.equal(normalizeUtmDimension("  "), null);
});
