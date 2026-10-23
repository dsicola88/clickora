import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { getOpsSnapshot, getRequestId, requestIdMiddleware } from "./opsObservability";

describe("opsObservability", () => {
  it("requestIdMiddleware define X-Request-Id e contadores", () => {
    const before = getOpsSnapshot().requests;
    const headers: Record<string, string> = {};
    const req = { headers: {}, path: "/api/health", method: "GET" } as unknown as Request;
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
      statusCode: 200,
      end: function (this: Response) {
        return this;
      },
    } as unknown as Response;
    let nextCalled = false;
    requestIdMiddleware(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.ok(headers["x-request-id"]);
    assert.equal(getRequestId(req), headers["x-request-id"]);
    assert.equal(getOpsSnapshot().requests, before + 1);
  });

  it("respeita X-Request-Id entrante", () => {
    const req = {
      headers: { "x-request-id": "client-fixed-id" },
      path: "/x",
      method: "GET",
    } as unknown as Request;
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
      statusCode: 200,
      end: function (this: Response) {
        return this;
      },
    } as unknown as Response;
    requestIdMiddleware(req, res, () => undefined);
    assert.equal(headers["x-request-id"], "client-fixed-id");
    assert.equal(getRequestId(req), "client-fixed-id");
  });
});
