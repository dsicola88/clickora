import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickRotatorDestination } from "./trafficRotator.service";

function arm(id: string, weight: number, url: string) {
  return {
    id,
    orderIndex: id === "a" ? 0 : 1,
    weight,
    clicksDelivered: 0,
    maxClicks: null,
    destinationUrl: url,
    label: id,
    countriesAllow: null,
    countriesDeny: null,
    deviceRule: "all" as const,
  };
}

function fakeDb(weights: [number, number]) {
  const updates: string[] = [];
  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        trafficRotator: {
          findFirst: async () => ({
            id: "rot-1",
            isActive: true,
            userId: "user-1",
            mode: "weighted",
            sequenceCursor: 0,
            backupUrl: null,
            rulesPolicy: null,
            arms: [
              arm("a", weights[0], "https://offer-a.example/buy"),
              arm("b", weights[1], "https://offer-b.example/buy"),
            ],
          }),
        },
        trafficRotatorArm: {
          update: async (args: { where: { id: string }; data: { clicksDelivered: { increment: number } } }) => {
            updates.push(args.where.id);
            assert.equal(args.data.clicksDelivered.increment, 1);
            return {};
          },
        },
      }),
  };
  return { db, updates };
}

describe("pickRotatorDestination", () => {
  it("escolhe o braço de peso 90 e incrementa só esse braço", async () => {
    const { db, updates } = fakeDb([90, 10]);
    const result = await pickRotatorDestination(
      "rot-1",
      { country: "PT", device: "desktop" },
      { db: db as never, randomUnit: 0.1 },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "a");
    assert.equal(result.destinationUrl, "https://offer-a.example/buy");
    assert.deepEqual(updates, ["a"]);
  });

  it("escolhe o braço de peso 10 quando o sorteio cai nesse intervalo", async () => {
    const { db, updates } = fakeDb([90, 10]);
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "mobile" },
      { db: db as never, randomUnit: 0.95 },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "b");
    assert.deepEqual(updates, ["b"]);
  });

  it("ignora o braço com peso zero", async () => {
    const { db, updates } = fakeDb([100, 0]);
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      { db: db as never, randomUnit: 0.99 },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "a");
    assert.deepEqual(updates, ["a"]);
  });
});
