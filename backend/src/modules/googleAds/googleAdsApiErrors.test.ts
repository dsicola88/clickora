import assert from "node:assert/strict";
import test from "node:test";
import { googleAdsErrorText, humanizeGoogleAdsApiError, plainGoogleAdsError } from "./googleAdsApiErrors";

test("erro da Google com mensagem em objecto não vira [object Object]", () => {
  const err = new Error("[object Object]");
  Object.assign(err, {
    errors: [{ message: "Request had invalid authentication credentials." }],
  });
  const text = googleAdsErrorText(err);
  assert.equal(text.includes("[object Object]"), false);
  assert.match(text, /autorização Google expirou|Não foi possível obter o custo/);
  assert.match(plainGoogleAdsError(err), /invalid authentication credentials/);
});

test("texto vazio não mostra detalhe técnico", () => {
  const text = humanizeGoogleAdsApiError("[object Object]");
  assert.equal(text.includes("[object Object]"), false);
  assert.equal(text.includes("Detalhe técnico"), false);
});
