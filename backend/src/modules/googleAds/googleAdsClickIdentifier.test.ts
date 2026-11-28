import test from "node:test";
import assert from "node:assert/strict";
import { pickGoogleClickIdentifier } from "./googleAds.service";

test("upload Google: envia exactamente um identificador (gclid > gbraid > wbraid)", () => {
  assert.deepEqual(pickGoogleClickIdentifier({ gclid: " G1 ", gbraid: "GB", wbraid: "WB" }), { gclid: "G1" });
  assert.deepEqual(pickGoogleClickIdentifier({ gclid: "", gbraid: "GB", wbraid: "WB" }), { gbraid: "GB" });
  assert.deepEqual(pickGoogleClickIdentifier({ gclid: null, gbraid: "  ", wbraid: "WB" }), { wbraid: "WB" });
  assert.deepEqual(pickGoogleClickIdentifier({}), {});
});
