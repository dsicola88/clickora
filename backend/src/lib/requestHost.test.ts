import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import { getRequestHostname } from "./requestHost";

function req(headers: Record<string, string>): Request {
  return { headers, hostname: "clickora-production.up.railway.app" } as unknown as Request;
}

describe("getRequestHostname", () => {
  it("prefere x-vercel-forwarded-host sobre railway Host", () => {
    const h = getRequestHostname(
      req({
        "x-vercel-forwarded-host": "honestverdictguide.online",
        host: "clickora-production.up.railway.app",
      }),
    );
    assert.equal(h, "honestverdictguide.online");
  });

  it("usa Origin quando só há Host de infra", () => {
    const h = getRequestHostname(
      req({
        host: "clickora-production.up.railway.app",
        origin: "https://honestverdictguide.online",
      }),
    );
    assert.equal(h, "honestverdictguide.online");
  });

  it("usa Referer como fallback", () => {
    const h = getRequestHostname(
      req({
        host: "clickora-production.up.railway.app",
        referer: "https://dailysmartpicks.online/p/foo",
      }),
    );
    assert.equal(h, "dailysmartpicks.online");
  });
});
