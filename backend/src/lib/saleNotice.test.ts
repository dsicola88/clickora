import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSaleNotice, isApprovedSaleNotice } from "./saleNotice";

describe("aviso de venda", () => {
  it("avisa venda nova, venda sem clique e pendente que passou a aprovada", () => {
    assert.equal(isApprovedSaleNotice("created"), true);
    assert.equal(isApprovedSaleNotice("created_unattributed"), true);
    assert.equal(isApprovedSaleNotice("approved_from_pending"), true);
    assert.equal(isApprovedSaleNotice("pending"), false);
    assert.equal(isApprovedSaleNotice("duplicate"), false);
    assert.equal(isApprovedSaleNotice("refunded"), false);
  });

  it("diz a comissão e que o clique ficou ligado", () => {
    const notice = buildSaleNotice({
      platform: "BuyGoods",
      product: "visivra_tsl2",
      amount: "21.85",
      currency: "USD",
      orderId: "ORD-1",
      linkedToClick: true,
      resultsUrl: "https://www.dclickora.com/resultados/relatorios/conversoes",
    });
    assert.match(notice.subject, /Venda — BuyGoods/);
    assert.match(notice.text, /Produto: visivra_tsl2/);
    assert.match(notice.text, /Comissão: 21,85 USD/);
    assert.match(notice.text, /ligada a um clique/);
    assert.match(notice.text, /conta fechada/);
    assert.match(notice.html, /21,85 USD/);
    assert.doesNotMatch(notice.text, /comprador/i);
    assert.equal(notice.pushTitle, "Nova venda aprovada!");
    assert.match(notice.pushBody, /visivra_tsl2 · Comissão: 21,85 USD/);
  });

  it("não inventa comissão nem um clique que a rede não enviou", () => {
    const notice = buildSaleNotice({
      platform: "MaxWeb",
      product: "{PRODUCT_CODENAME}",
      amount: null,
      currency: null,
      orderId: null,
      linkedToClick: false,
      resultsUrl: "https://www.dclickora.com/resultados/relatorios/conversoes",
    });
    assert.match(notice.subject, /sem clique/);
    assert.match(notice.text, /não enviou o produto/);
    assert.doesNotMatch(notice.text, /PRODUCT_CODENAME/);
    assert.match(notice.text, /não enviou a comissão/);
    assert.match(notice.text, /não devolveu o clique/);
    assert.equal(notice.pushTitle, "Nova venda aprovada!");
    assert.match(notice.pushBody, /sem clique/);
  });
});
