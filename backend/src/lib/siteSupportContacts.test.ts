import assert from "node:assert/strict";
import {
  formatSupportPhoneDisplay,
  mapSiteSupportContacts,
  normalizeSupportEmail,
  normalizeSupportPhone,
  supportWhatsappUrl,
} from "./siteSupportContacts";

assert.equal(normalizeSupportEmail("  DClickoraOficial@gmail.com "), "dclickoraoficial@gmail.com");
assert.throws(() => normalizeSupportEmail("nao-email"), /inválido/i);
assert.equal(normalizeSupportEmail(""), null);

assert.equal(normalizeSupportPhone("+244 926 510 294"), "+244926510294");
assert.equal(normalizeSupportPhone("244926510294"), "+244926510294");
assert.throws(() => normalizeSupportPhone("123"), /inválido/i);

assert.equal(formatSupportPhoneDisplay("+244926510294"), "+244 926 510 294");
assert.equal(supportWhatsappUrl("+244926510294"), "https://wa.me/244926510294");

const empty = mapSiteSupportContacts(null);
assert.equal(empty.configured, false);
assert.equal(empty.support_email, null);

const full = mapSiteSupportContacts({
  supportEmail: "dclickoraoficial@gmail.com",
  supportPhone: "+244926510294",
  updatedAt: new Date("2026-11-10T00:00:00.000Z"),
});
assert.equal(full.configured, true);
assert.equal(full.support_phone_display, "+244 926 510 294");

console.log("siteSupportContacts.test.ts: ok");
