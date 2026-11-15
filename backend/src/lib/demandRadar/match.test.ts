import assert from "node:assert/strict";
import test from "node:test";
import { demandTextMatches, normalizeDemandNeedle } from "./match";

test("demandRadar match normaliza acentos e pontuação", () => {
  assert.equal(normalizeDemandNeedle(" Visivra™ Max "), "visivra max");
});

test("demandRadar match casa produto com título de presell", () => {
  assert.equal(demandTextMatches("Presell Visivra Review US", "visivra"), true);
  assert.equal(demandTextMatches("Outro produto", "visivra"), false);
});

test("demandRadar match não casa strings vazias", () => {
  assert.equal(demandTextMatches("", "a"), false);
  assert.equal(demandTextMatches("abc", ""), false);
});
