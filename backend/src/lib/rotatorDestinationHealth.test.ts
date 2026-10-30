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

  it("marca 5xx / timeout como unhealthy; 200 e 404 (default) como healthy", async () => {
    const { clearRotatorDestinationHealthCache } = await import("./rotatorDestinationHealth");
    clearRotatorDestinationHealthCache();

    const ok = await probeRotatorDestinationQuick("https://ok.example/path", {
      bypassCache: true,
      fetchImpl: (async () => new Response(null, { status: 200 })) as unknown as typeof fetch,
    });
    assert.equal(ok.healthy, true);

    const soft404 = await probeRotatorDestinationQuick("https://ok.example/missing", {
      bypassCache: true,
      fetchImpl: (async () => new Response(null, { status: 404 })) as unknown as typeof fetch,
    });
    assert.equal(soft404.healthy, true);

    const bad = await probeRotatorDestinationQuick("https://down.example/", {
      bypassCache: true,
      fetchImpl: (async () => new Response(null, { status: 503 })) as unknown as typeof fetch,
    });
    assert.equal(bad.healthy, false);
    assert.equal(bad.reason, "upstream_5xx");

    const timed = await probeRotatorDestinationQuick("https://slow.example/", {
      bypassCache: true,
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
