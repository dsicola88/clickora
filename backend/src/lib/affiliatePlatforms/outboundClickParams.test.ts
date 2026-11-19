import assert from "node:assert/strict";
import test from "node:test";
import {
  AFFILIATE_OUTBOUND_CLICK_KEYS,
  outboundClickKeys,
  platformIdFromOfferHost,
} from "./outboundClickParams";
import { appendClickIdToAffiliateUrl } from "../appendClickIdToUrl";
import { parseAffiliatePostback } from "./parseAffiliatePostback";

const UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

/** Chaves que o parser genérico / nativo deve aceitar no postback (além de clickora_click_id). */
const PARSER_ACCEPTS: Record<string, readonly string[]> = {
  digistore24: ["sid1", "cid"],
  buygoods: ["subid2", "subid"],
  maxweb: ["subid2", "subid"],
  smartadv: ["sub3"],
  hotmart: ["src", "sck"],
  clickbank: ["tid"],
  warriorplus: ["tid", "WP_TID"],
  jvzoo: ["tid"],
  monetizze: ["src", "sck"],
  braip: ["xcod"],
  adcombo: ["clickid"],
  everflow: ["sub1"],
  eduzz: ["tracker"],
  leadbit: ["subid"],
  drcash: ["sub1"],
  maxbounty: ["s1"],
  kiwify: ["src", "sck"],
};

test("cada chave OUTBOUND tem eco no parser", () => {
  for (const [id, keys] of Object.entries(AFFILIATE_OUTBOUND_CLICK_KEYS)) {
    const accepted = PARSER_ACCEPTS[id];
    assert.ok(accepted, `PARSER_ACCEPTS em falta para ${id}`);
    for (const key of keys) {
      assert.ok(
        accepted.includes(key) || accepted.some((a) => a.toLowerCase() === key.toLowerCase()),
        `${id}: outbound ${key} sem leitura no postback`,
      );
    }
  }
});

test("host detection cobre redes documented_s2s", () => {
  assert.equal(platformIdFromOfferHost("go.monetizze.com.br"), "monetizze");
  assert.equal(platformIdFromOfferHost("ev.braip.com"), "braip");
  assert.equal(platformIdFromOfferHost("sun.eduzz.com"), "eduzz");
  assert.equal(platformIdFromOfferHost("ads.adcombo.com"), "adcombo");
  assert.equal(platformIdFromOfferHost("www.everflow.io"), "everflow");
  assert.equal(platformIdFromOfferHost("go.leadbit.com"), "leadbit");
  assert.equal(platformIdFromOfferHost("dr.cash"), "drcash");
  assert.equal(platformIdFromOfferHost("www.maxbounty.com"), "maxbounty");
  assert.equal(platformIdFromOfferHost("pay.kiwify.com.br"), "kiwify");
  assert.equal(platformIdFromOfferHost("unknown.example"), null);
});

test("hop→postback: eco só da chave outbound aprova venda documented_s2s", () => {
  const samples: Array<{ host: string; platform: string; key: string }> = [
    { host: "https://go.monetizze.com.br/x", platform: "Monetizze", key: "src" },
    { host: "https://ev.braip.com/x", platform: "Braip", key: "xcod" },
    { host: "https://ads.adcombo.com/x", platform: "AdCombo", key: "clickid" },
    { host: "https://www.everflow.io/x", platform: "EverFlow", key: "sub1" },
  ];
  for (const { host, platform, key } of samples) {
    const hop = new URL(appendClickIdToAffiliateUrl(host, UUID));
    assert.equal(hop.searchParams.get(key), UUID, `${platform} hop ${key}`);
    assert.equal(hop.searchParams.get("clickora_click_id"), UUID);

    const parsed = parseAffiliatePostback({
      platform,
      flat: {
        [key]: hop.searchParams.get(key)!,
        orderid: `E2E-${key}`,
        amount: "5.00",
        status: "approved",
      },
    });
    assert.equal(parsed.outcome.kind, "approved", platform);
    assert.equal(parsed.clickId, UUID, platform);
  }
});

test("outboundClickKeys devolve lista vazia para id desconhecido", () => {
  assert.deepEqual(outboundClickKeys(null), []);
  assert.deepEqual(outboundClickKeys("nope"), []);
  assert.deepEqual([...outboundClickKeys("maxweb")], ["subid", "subid2"]);
});
