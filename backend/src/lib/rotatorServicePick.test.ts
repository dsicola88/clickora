import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickRotatorDestination } from "./trafficRotator.service";

function arm(id: string, weight: number, url: string, extra?: Partial<{ maxClicks: number | null; clicksDelivered: number; orderIndex: number }>) {
  return {
    id,
    orderIndex: extra?.orderIndex ?? (id === "a" ? 0 : id === "b" ? 1 : 2),
    weight,
    clicksDelivered: extra?.clicksDelivered ?? 0,
    maxClicks: extra?.maxClicks ?? null,
    destinationUrl: url,
    label: id,
    countriesAllow: null,
    countriesDeny: null,
    deviceRule: "all" as const,
  };
}

function fakeDb(opts: {
  mode?: "weighted" | "sequential" | "fill_order" | "random";
  weights?: [number, number] | [number, number, number];
  backupUrl?: string | null;
  arms?: ReturnType<typeof arm>[];
  sequenceCursor?: number;
  stickySession?: boolean;
}) {
  const updates: string[] = [];
  const seqUpdates: number[] = [];
  const arms =
    opts.arms ??
    [
      arm("a", opts.weights?.[0] ?? 90, "https://offer-a.example/buy"),
      arm("b", opts.weights?.[1] ?? 10, "https://offer-b.example/buy"),
    ];
  const rot = {
    id: "rot-1",
    isActive: true,
    userId: "user-1",
    mode: opts.mode ?? "weighted",
    sequenceCursor: opts.sequenceCursor ?? 0,
    backupUrl: opts.backupUrl ?? null,
    stickySession: opts.stickySession ?? false,
    rulesPolicy: null,
    arms,
  };
  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        trafficRotator: {
          findFirst: async () => ({ ...rot, arms: [...arms] }),
          update: async (args: { data: { sequenceCursor: number } }) => {
            seqUpdates.push(args.data.sequenceCursor);
            rot.sequenceCursor = args.data.sequenceCursor;
            return {};
          },
        },
        trafficRotatorArm: {
          update: async (args: { where: { id: string }; data: { clicksDelivered: { increment: number } } }) => {
            updates.push(args.where.id);
            assert.equal(args.data.clicksDelivered.increment, 1);
            return {};
          },
        },
        trackingEvent: { count: async () => 0 },
      }),
  };
  return { db, updates, seqUpdates };
}

describe("pickRotatorDestination", () => {
  it("A/B ponderado 90/10 — escolhe o braço de peso 90", async () => {
    const { db, updates } = fakeDb({ weights: [90, 10] });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: "PT", device: "desktop" },
      { db: db as never, randomUnit: 0.1, probeEnabled: false },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "a");
    assert.equal(result.destinationUrl, "https://offer-a.example/buy");
    assert.deepEqual(updates, ["a"]);
  });

  it("A/B ponderado — sorteio no intervalo do braço leve", async () => {
    const { db, updates } = fakeDb({ weights: [90, 10] });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "mobile" },
      { db: db as never, randomUnit: 0.95, probeEnabled: false },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "b");
    assert.deepEqual(updates, ["b"]);
  });

  it("ignora o braço com peso zero", async () => {
    const { db, updates } = fakeDb({ weights: [100, 0] });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      { db: db as never, randomUnit: 0.99, probeEnabled: false },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "a");
    assert.deepEqual(updates, ["a"]);
  });

  it("sequential (WhatsApp / round-robin) avança o cursor", async () => {
    const { db, updates, seqUpdates } = fakeDb({
      mode: "sequential",
      arms: [
        arm("v1", 100, "https://wa.me/351911111111", { orderIndex: 0 }),
        arm("v2", 100, "https://wa.me/351922222222", { orderIndex: 1 }),
        arm("v3", 100, "https://wa.me/351933333333", { orderIndex: 2 }),
      ],
      sequenceCursor: 1,
    });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: "PT", device: "mobile" },
      { db: db as never, randomUnit: 0, probeEnabled: false },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "v2");
    assert.equal(result.destinationUrl, "https://wa.me/351922222222");
    assert.deepEqual(updates, ["v2"]);
    assert.deepEqual(seqUpdates, [2]);
  });

  it("fill_order esgota o 1.º braço (max_clicks) e passa ao seguinte", async () => {
    const { db, updates } = fakeDb({
      mode: "fill_order",
      arms: [
        arm("a", 100, "https://offer-a.example/", { orderIndex: 0, maxClicks: 10, clicksDelivered: 10 }),
        arm("b", 100, "https://offer-b.example/", { orderIndex: 1, maxClicks: 10, clicksDelivered: 0 }),
      ],
    });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      { db: db as never, randomUnit: 0, probeEnabled: false },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "b");
    assert.deepEqual(updates, ["b"]);
  });

  it("contingência: sem braços elegíveis → backup_url", async () => {
    const { db, updates } = fakeDb({
      mode: "weighted",
      backupUrl: "https://backup.example/safe",
      arms: [
        arm("a", 100, "https://offer-a.example/", { maxClicks: 1, clicksDelivered: 1 }),
        arm("b", 100, "https://offer-b.example/", { maxClicks: 1, clicksDelivered: 1 }),
      ],
    });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      { db: db as never, randomUnit: 0, probeEnabled: false },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.usedBackup, true);
    assert.equal(result.destinationUrl, "https://backup.example/safe");
    assert.equal(result.armId, null);
    assert.deepEqual(updates, []);
  });

  it("contingência health: destino 503 → falha para backup", async () => {
    const { db, updates } = fakeDb({
      mode: "weighted",
      weights: [100, 0],
      backupUrl: "https://backup.example/safe",
    });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      {
        db: db as never,
        randomUnit: 0.1,
        probeEnabled: true,
        probe: async () => ({ healthy: false, status: 503, reason: "upstream_5xx" }),
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.usedBackup, true);
    assert.equal(result.healthFailover, true);
    assert.equal(result.destinationUrl, "https://backup.example/safe");
    assert.deepEqual(updates, []);
  });

  it("contingência health: 1.º braço down → usa 2.º braço saudável", async () => {
    const { db, updates } = fakeDb({
      mode: "weighted",
      weights: [100, 100],
      backupUrl: "https://backup.example/safe",
    });
    let probes = 0;
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      {
        db: db as never,
        randomUnit: 0.1,
        probeEnabled: true,
        probe: async (url) => {
          probes += 1;
          if (url.includes("offer-a")) return { healthy: false, status: 503, reason: "upstream_5xx" };
          return { healthy: true, status: 200 };
        },
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "b");
    assert.equal(result.healthFailover, true);
    assert.equal(result.usedBackup, false);
    assert.ok(probes >= 2);
    assert.deepEqual(updates, ["b"]);
  });

  it("sticky session: reutiliza braço do cookie em weighted", async () => {
    const { db, updates } = fakeDb({ stickySession: true, weights: [90, 10] });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: "PT", device: "desktop" },
      { db: db as never, randomUnit: 0.1, probeEnabled: false, stickyArmId: "b" },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "b");
    assert.deepEqual(updates, ["b"]);
  });

  it("sticky session: sequential ignora cookie (mantém round-robin)", async () => {
    const { db, updates } = fakeDb({
      mode: "sequential",
      stickySession: true,
      sequenceCursor: 0,
      arms: [
        arm("a", 100, "https://offer-a.example/buy", { orderIndex: 0 }),
        arm("b", 100, "https://offer-b.example/buy", { orderIndex: 1 }),
      ],
    });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      { db: db as never, randomUnit: 0.5, probeEnabled: false, stickyArmId: "b" },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "a");
    assert.deepEqual(updates, ["a"]);
  });

  it("random escolhe braço pelo randomUnit", async () => {
    const { db, updates } = fakeDb({
      mode: "random",
      arms: [
        arm("a", 100, "https://offer-a.example/buy", { orderIndex: 0 }),
        arm("b", 100, "https://offer-b.example/buy", { orderIndex: 1 }),
      ],
    });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      { db: db as never, randomUnit: 0.6, probeEnabled: false },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "b");
    assert.deepEqual(updates, ["b"]);
  });

  it("sticky: braço do cookie esgotado (max_clicks) → sorteia outro", async () => {
    const { db, updates } = fakeDb({
      stickySession: true,
      weights: [50, 50],
      arms: [
        arm("a", 50, "https://offer-a.example/buy", { maxClicks: 1, clicksDelivered: 1, orderIndex: 0 }),
        arm("b", 50, "https://offer-b.example/buy", { orderIndex: 1 }),
      ],
    });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      { db: db as never, randomUnit: 0.1, probeEnabled: false, stickyArmId: "a" },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "b");
    assert.deepEqual(updates, ["b"]);
  });

  it("sticky desligado: ignora cookie", async () => {
    const { db, updates } = fakeDb({ stickySession: false, weights: [90, 10] });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: "PT", device: "desktop" },
      { db: db as never, randomUnit: 0.1, probeEnabled: false, stickyArmId: "b" },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "a");
    assert.deepEqual(updates, ["a"]);
  });

  it("sem cookie sticky: comportamento normal", async () => {
    const { db, updates } = fakeDb({ stickySession: true, weights: [90, 10] });
    const result = await pickRotatorDestination(
      "rot-1",
      { country: null, device: "desktop" },
      { db: db as never, randomUnit: 0.1, probeEnabled: false },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.armId, "a");
    assert.deepEqual(updates, ["a"]);
  });
});
