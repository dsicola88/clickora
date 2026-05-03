import assert from "node:assert/strict";
import test from "node:test";
import { extractClickIdFromPayload, mergeJsonBodyIntoFlatRecord } from "./affiliatePostbackParsers";

test("merge nested object exposes dotted keys and leaf alias for subid1", () => {
  const out: Record<string, string> = {};
  const uuid = "550e8400-e29b-41d4-a716-446655440000";
  mergeJsonBodyIntoFlatRecord({ data: { subid1: uuid, status: "approved" } }, out);
  assert.equal(out["data.subid1"], uuid);
  assert.equal(out["data.status"], "approved");
  assert.equal(out.subid1, uuid);
  assert.equal(out.status, "approved");
});

test("nested click_id maps leaf and extract finds uuid", () => {
  const out: Record<string, string> = {};
  const uuid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  mergeJsonBodyIntoFlatRecord({ payload: { click_id: uuid } }, out);
  assert.equal(out["payload.click_id"], uuid);
  assert.equal(out.click_id, uuid);
  assert.equal(extractClickIdFromPayload(out), uuid);
});
