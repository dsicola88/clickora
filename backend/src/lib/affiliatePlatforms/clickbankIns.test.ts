import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import test from "node:test";
import {
  clickbankInsKey,
  clickbankSaleFields,
  decryptClickbankNotification,
} from "./clickbankIns";

const SECRET = "CBSECRET1";
const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function encrypt(plaintext: string, secret: string) {
  const key = clickbankInsKey(secret);
  const iv = randomBytes(16);
  const pad = (16 - (Buffer.byteLength(plaintext) % 16)) % 16;
  const padded = Buffer.concat([Buffer.from(plaintext, "utf8"), Buffer.alloc(pad)]);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);
  const data = Buffer.concat([cipher.update(padded), cipher.final()]);
  return { notification: data.toString("base64"), iv: iv.toString("base64") };
}

test("ClickBank INS decifra a venda e ignora o segredo errado", () => {
  const payload = JSON.stringify({
    transactionType: "SALE",
    receipt: "R9",
    totalAccountAmount: "15.00",
    tid: UUID,
    customer: { email: "buyer@example.com" },
  });
  const envelope = encrypt(payload, SECRET);
  const plain = decryptClickbankNotification(envelope.notification, envelope.iv, SECRET);
  assert.ok(plain);
  const fields = clickbankSaleFields(plain!);
  assert.equal(fields?.transactionType, "SALE");
  assert.equal(fields?.receipt, "R9");
  assert.equal(fields?.totalAccountAmount, "15.00");
  assert.equal(fields?.tid, UUID);
  assert.equal("customer" in (fields || {}), false);
  const wrong = decryptClickbankNotification(envelope.notification, envelope.iv, "OUTRA");
  assert.equal(wrong ? clickbankSaleFields(wrong) : null, null);
});
