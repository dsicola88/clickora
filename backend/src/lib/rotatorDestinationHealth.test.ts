import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRotatorDestinationProbeable,
  probeRotatorDestinationQuick,
} from "./rotatorDestinationHealth";

describe("rotatorDestinationHealth", () => {
  it("não sonda WhatsApp / Telegram (round-robin de atendimento)", () => {
    assert.equal(isRotatorDestinationProbeable("https://wa.me/351912345678"), false);
    assert.equal(isRotatorDestinationProbeable("https://api.whatsapp.com/send?phone=3519"), false);
    assert.equal(isRotatorDestinationProbeable("https://t.me/vendedor1"), false);
    assert.equal(isRotatorDestinationProbeable("https://offer.example/buy"), true);
  });

  it("marca 5xx / timeout como unhealthy e 200 como healthy", async () => {
    const ok = await probeRotatorDestinationQuick("https://ok.example/", {
      fetchImpl: (async () =>
        new Response(null, { status: 200 })) as unknown as typeof fetch,
    });
    assert.equal(ok.healthy, true);

    const bad = await probeRotatorDestinationQuick("https://down.example/", {
      fetchImpl: (async () =>
        new Response(null, { status: 503 })) as unknown as typeof fetch,
    });
    assert.equal(bad.healthy, false);
    assert.equal(bad.reason, "upstream_5xx");

    const timed = await probeRotatorDestinationQuick("https://slow.example/", {
      timeoutMs: 20,
      fetchImpl: (async (_url, init) => {
        await new Promise((_, rej) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            rej(err);
          });
        });
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    });
    assert.equal(timed.healthy, false);
    assert.equal(timed.reason, "timeout");
  });
});
