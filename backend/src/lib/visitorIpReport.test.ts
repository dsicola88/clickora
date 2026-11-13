import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyVisitorIpFlags } from "./visitorIpReport";

describe("classifyVisitorIpFlags", () => {
  it("nunca marca Googlebot como rato", () => {
    const r = classifyVisitorIpFlags({
      visits: 40,
      clicks: 20,
      has_sale: false,
      is_bot: true,
      bot_label: "Googlebot",
      is_cloud: false,
      traffic_type: "paid",
    });
    assert.equal(r.is_rato, false);
  });

  it("marca pago repetido sem venda como rato", () => {
    const r = classifyVisitorIpFlags({
      visits: 6,
      clicks: 3,
      has_sale: false,
      is_bot: false,
      bot_label: null,
      is_cloud: false,
      traffic_type: "paid",
    });
    assert.equal(r.is_rato, true);
    assert.equal(r.fuga_pct, 50);
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
    });
    assert.equal(r.is_rato, false);
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
    });
    assert.equal(r.fuga_pct, 66.67);
    assert.equal(r.is_rato, false);
  });
});
