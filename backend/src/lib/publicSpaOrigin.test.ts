import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import { publicSpaPresellUrl, resolvePublicAppOrigin } from "./publicSpaOrigin";

function fakeReq(partial: {
  query?: Record<string, string>;
  headers?: Record<string, string>;
  host?: string;
  protocol?: string;
}): Request {
  const headers = partial.headers || {};
  return {
    query: partial.query || {},
    protocol: partial.protocol || "http",
    get(name: string) {
      const key = name.toLowerCase();
      if (key === "host") return partial.host || headers.host || "";
      return headers[key] || headers[name] || "";
    },
  } as unknown as Request;
}

describe("publicSpaOrigin", () => {
  it("usa spa_origin da query em pedido directo à API", () => {
    const req = fakeReq({
      host: "localhost:3001",
      query: { spa_origin: "http://localhost:8080" },
    });
    assert.equal(resolvePublicAppOrigin(req), "http://localhost:8080");
    assert.equal(
      publicSpaPresellUrl(req, "11111111-1111-4111-8111-111111111111"),
      "http://localhost:8080/p/11111111-1111-4111-8111-111111111111",
    );
  });

  it("com rewrite same-host devolve origem do host", () => {
    const req = fakeReq({
      host: "www.dclickora.com",
      protocol: "https",
      headers: { "x-forwarded-proto": "https", "x-forwarded-host": "www.dclickora.com" },
    });
    assert.equal(resolvePublicAppOrigin(req), "https://www.dclickora.com");
  });
});
