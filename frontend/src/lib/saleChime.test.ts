import { describe, expect, it } from "vitest";
import { claimSaleChime, nextSaleChimeAction, parseSaleChimeId, saleChimeId } from "./saleChime";

const now = Date.parse("2026-10-14T16:00:00.000Z");

describe("som de venda", () => {
  it("não toca a venda que já estava na conta ao abrir a página", () => {
    const first = nextSaleChimeAction({
      primed: false,
      previousId: null,
      nextId: "venda-1",
      createdAt: "2026-10-14T15:59:50.000Z",
      nowMs: now,
      enabled: true,
    });
    expect(first.play).toBe(false);
    expect(first.primed).toBe(true);

    const same = nextSaleChimeAction({
      primed: first.primed,
      previousId: first.previousId,
      nextId: "venda-1",
      createdAt: "2026-10-14T15:59:50.000Z",
      nowMs: now,
      enabled: true,
    });
    expect(same.play).toBe(false);
  });

  it("toca quando entra uma venda nova e recente", () => {
    const next = nextSaleChimeAction({
      primed: true,
      previousId: "venda-1",
      nextId: "venda-2",
      createdAt: "2026-10-14T15:59:30.000Z",
      nowMs: now,
      enabled: true,
    });
    expect(next.play).toBe(true);
    expect(next.previousId).toBe("venda-2");
  });

  it("não toca uma venda antiga nem com o som desligado", () => {
    const old = nextSaleChimeAction({
      primed: true,
      previousId: "venda-1",
      nextId: "venda-2",
      createdAt: "2026-10-14T12:00:00.000Z",
      nowMs: now,
      enabled: true,
    });
    expect(old.play).toBe(false);

    const off = nextSaleChimeAction({
      primed: true,
      previousId: "venda-1",
      nextId: "venda-2",
      createdAt: "2026-10-14T15:59:30.000Z",
      nowMs: now,
      enabled: false,
    });
    expect(off.play).toBe(false);
    expect(off.previousId).toBe("venda-2");
  });

  it("aceita os quatro sons e ignora um nome desconhecido", () => {
    expect(parseSaleChimeId("kaching")).toBe("kaching");
    expect(parseSaleChimeId("chaching")).toBe("chaching");
    expect(parseSaleChimeId("moedas")).toBe("moedas");
    expect(parseSaleChimeId("sino")).toBe("sino");
    expect(parseSaleChimeId("pix")).toBeNull();
  });

  it("trata o aviso do telemóvel e a lista como a mesma venda", () => {
    expect(saleChimeId("sale-abc")).toBe("abc");
    expect(claimSaleChime("sale-abc")).toBe(true);
    expect(claimSaleChime("abc")).toBe(false);
  });
});
