import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMediaBuyerAlerts,
  campaignProductStem,
  campaignUtmSlug,
  computePerf,
  saleProductMatchesCampaign,
} from "./campaignPerf";

test("campaignUtmSlug normaliza acentos e espaços", () => {
  assert.equal(campaignUtmSlug("Oferta Verão PT"), "oferta-verao-pt");
  assert.equal(campaignUtmSlug("Neotonics Google Ads"), "neotonics-google-ads");
});

test("o produto da rede casa com a campanha e a macro não casa", () => {
  assert.equal(campaignProductStem("Visivra2"), "visivra");
  assert.equal(saleProductMatchesCampaign("visivra_tsl2", "Visivra2"), true);
  assert.equal(saleProductMatchesCampaign("visivra_tsl2", "Yusleep"), false);
  assert.equal(saleProductMatchesCampaign("yusleep", "Sleep"), false);
  assert.equal(saleProductMatchesCampaign("{PRODUCT_CODENAME}", "Visivra2"), false);
  assert.equal(saleProductMatchesCampaign("visivra_tsl2", "Ab"), false);
});

test("computePerf calcula ROAS, CPA, EPC e lucro", () => {
  const p = computePerf({ clicks: 100, conversions: 5, revenue: 250, spend: 100 });
  assert.equal(p.roas, 2.5);
  assert.equal(p.cpa, 20);
  assert.equal(p.epc, 2.5);
  assert.equal(p.profit, 150);
  assert.equal(p.conversion_rate, 5);
});

test("computePerf sem gasto devolve lucro/ROAS/CPA null", () => {
  const p = computePerf({ clicks: 10, conversions: 1, revenue: 40, spend: null });
  assert.equal(p.profit, null);
  assert.equal(p.roas, null);
  assert.equal(p.cpa, null);
  assert.equal(p.epc, 4);
});

test("alerta gasto sem vendas", () => {
  const alerts = buildMediaBuyerAlerts({
    clicks: 20,
    conversions: 0,
    revenue: 0,
    spend: 50,
    spendSource: "manual",
  });
  assert.ok(alerts.some((a) => a.code === "spend_no_sales"));
});

test("alerta CPA acima da comissão", () => {
  const alerts = buildMediaBuyerAlerts({
    clicks: 40,
    conversions: 2,
    revenue: 40,
    spend: 100,
    spendSource: "google_ads",
  });
  assert.ok(alerts.some((a) => a.code === "cpa_above_aov"));
});

test("info quando não há gasto", () => {
  const alerts = buildMediaBuyerAlerts({
    clicks: 5,
    conversions: 1,
    revenue: 30,
    spend: null,
    spendSource: "none",
  });
  assert.ok(alerts.some((a) => a.code === "no_spend"));
});
