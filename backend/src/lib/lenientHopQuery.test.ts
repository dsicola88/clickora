import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { parseLenientHopQuery } from "./lenientHopQuery";

const schema = z.object({
  to: z.string().url().optional(),
  gclid: z.string().optional(),
  gad_source: z.string().max(32).optional(),
  parent_click_id: z.string().uuid().optional(),
});

describe("parseLenientHopQuery", () => {
  it("gclid repetido → primeiro valor, sem rejeitar", () => {
    const { data, dropped } = parseLenientHopQuery(schema, { gclid: ["Cj0a", "Cj0a"] });
    assert.equal(data.gclid, "Cj0a");
    assert.deepEqual(dropped, []);
  });

  it("campos inválidos são descartados, o resto mantém-se", () => {
    const { data, dropped } = parseLenientHopQuery(schema, {
      to: "nao-e-url",
      parent_click_id: "x",
      gad_source: "y".repeat(40),
      gclid: "Cj0keep",
    });
    assert.equal(data.gclid, "Cj0keep");
    assert.equal(data.to, undefined);
    assert.equal(data.parent_click_id, undefined);
    assert.equal(data.gad_source, undefined);
    assert.deepEqual(dropped.sort(), ["gad_source", "parent_click_id", "to"]);
  });

  it("objetos aninhados (qs a[b]=c) são ignorados", () => {
    const { data } = parseLenientHopQuery(schema, { gclid: { a: "b" } });
    assert.equal(data.gclid, undefined);
  });
});
