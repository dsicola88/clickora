import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rankCreativeVariants } from "./creativeRanking";

describe("rankCreativeVariants", () => {
  it("escolhe vencedor por CTR com impressões suficientes", () => {
    const out = rankCreativeVariants(
      [
        {
          id: "a",
          label: "Fraco",
          external_id: "1",
          impressions: 1000,
          clicks: 10,
          spend_usd: 40,
          conversions: 0,
          ctr: 0.01,
        },
        {
          id: "b",
          label: "Forte",
          external_id: "2",
          impressions: 1000,
          clicks: 50,
          spend_usd: 40,
          conversions: 2,
          ctr: 0.05,
        },
      ],
      { minImpressions: 100 },
    );
    assert.equal(out.winner_id, "b");
    assert.equal(out.loser_id, "a");
    assert.equal(out.ranked[0]!.id, "b");
    assert.equal(out.ranked.length, 2);
  });

  it("adia ranking abaixo do mínimo de impressões", () => {
    const out = rankCreativeVariants(
      [
        {
          id: "a",
          label: "Novo",
          external_id: "1",
          impressions: 20,
          clicks: 5,
          spend_usd: 2,
          conversions: 1,
          ctr: 0.25,
        },
      ],
      { minImpressions: 100 },
    );
    assert.equal(out.winner_id, null);
    assert.equal(out.ranked.length, 0);
    assert.match(out.note, /adiado/i);
  });

  it("sem perdedor quando só há uma elegível", () => {
    const out = rankCreativeVariants(
      [
        {
          id: "solo",
          label: "Única",
          external_id: "9",
          impressions: 500,
          clicks: 25,
          spend_usd: 10,
          conversions: 1,
          ctr: 0.05,
        },
      ],
      { minImpressions: 100 },
    );
    assert.equal(out.winner_id, "solo");
    assert.equal(out.loser_id, null);
  });
});
