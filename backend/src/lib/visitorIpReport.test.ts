import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyVisitorIpFlags } from "./visitorIpReport";

describe("classifyVisitorIpFlags", () => {
  it("nunca marca Googlebot como suspeito", () => {
    const r = classifyVisitorIpFlags({
      visits: 40,
      clicks: 20,
      has_sale: false,
      is_bot: true,
      bot_label: "Googlebot",
      is_cloud: false,
      traffic_type: "paid",
      country: "US",
    });
    assert.equal(r.is_suspect, false);
    assert.deepEqual(r.suspect_reasons, []);
  });

  it("marca pago repetido sem venda como suspeito", () => {
    const r = classifyVisitorIpFlags({
      visits: 3,
      clicks: 2,
      has_sale: false,
      is_bot: false,
      bot_label: null,
      is_cloud: false,
      traffic_type: "paid",
      country: "US",
    });
    assert.equal(r.is_suspect, true);
    assert.ok(r.suspect_reasons.includes("paid_repeat_visits"));
    assert.ok(r.suspect_reasons.includes("paid_repeat_clicks"));
    assert.equal(r.fuga_pct, 33.33);
  });

  it("marca sem ID de clique repetido", () => {
    const r = classifyVisitorIpFlags({
      visits: 2,
      clicks: 0,
      has_sale: false,
      is_bot: false,
      bot_label: null,
      is_cloud: false,
      traffic_type: "paid_untracked",
      country: "AU",
    });
    assert.equal(r.is_suspect, true);
    assert.ok(r.suspect_reasons.includes("paid_missing_click_id"));
  });

  it("marca geo de alta concorrência de afiliados", () => {
    const r = classifyVisitorIpFlags({
      visits: 2,
      clicks: 0,
      has_sale: false,
      is_bot: false,
      bot_label: null,
      is_cloud: false,
      traffic_type: "paid",
      country: "BR",
    });
    assert.equal(r.is_suspect, true);
    assert.ok(r.suspect_reasons.includes("competition_geo"));
  });

  it("não marca quem já comprou", () => {
    const r = classifyVisitorIpFlags({
      visits: 10,
      clicks: 8,
      has_sale: true,
      is_bot: false,
      bot_label: null,
      is_cloud: false,
      traffic_type: "paid",
      country: "BR",
    });
    assert.equal(r.is_suspect, false);
  });

  it("calcula % fuga a partir de visitas e cliques", () => {
    const r = classifyVisitorIpFlags({
      visits: 9,
      clicks: 3,
      has_sale: false,
      is_bot: true,
      bot_label: "OtherBot",
      is_cloud: false,
      traffic_type: "organic",
      country: null,
    });
    assert.equal(r.fuga_pct, 66.67);
    assert.equal(r.is_suspect, false);
  });
});
