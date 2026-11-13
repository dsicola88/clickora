import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cloudflareVisitorCountryFromRequest,
  requestFromTrustedTrackEdge,
  trackEdgeSharedSecret,
  visitorIpFromTrustedTrackEdge,
} from "./trackEdgeAuth";

function fakeReq(headers: Record<string, string>) {
  return {
    get(name: string) {
      const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
      return key ? headers[key] : undefined;
    },
  } as import("express").Request;
}

describe("trackEdgeAuth", () => {
  it("trackEdgeSharedSecret lê TRACK_EDGE_SHARED_SECRET", () => {
    const prev = process.env.TRACK_EDGE_SHARED_SECRET;
    process.env.TRACK_EDGE_SHARED_SECRET = "edge-secret-test";
    try {
      assert.equal(trackEdgeSharedSecret(), "edge-secret-test");
      assert.equal(requestFromTrustedTrackEdge(fakeReq({ "x-clickora-edge-secret": "edge-secret-test" })), true);
      assert.equal(requestFromTrustedTrackEdge(fakeReq({ "x-clickora-edge-secret": "wrong" })), false);
    } finally {
      if (prev === undefined) delete process.env.TRACK_EDGE_SHARED_SECRET;
      else process.env.TRACK_EDGE_SHARED_SECRET = prev;
    }
  });

  it("cloudflareVisitorCountryFromRequest ignora XX/T1", () => {
    assert.equal(cloudflareVisitorCountryFromRequest(fakeReq({ "cf-ipcountry": "BR" })), "BR");
    assert.equal(cloudflareVisitorCountryFromRequest(fakeReq({ "cf-ipcountry": "xx" })), null);
    assert.equal(cloudflareVisitorCountryFromRequest(fakeReq({ "cf-ipcountry": "T1" })), null);
  });

  it("visitorIpFromTrustedTrackEdge usa CF-Connecting-IP com secret", () => {
    const prev = process.env.TRACK_EDGE_SHARED_SECRET;
    process.env.TRACK_EDGE_SHARED_SECRET = "edge-secret-test";
    try {
      assert.equal(
        visitorIpFromTrustedTrackEdge(
          fakeReq({
            "x-clickora-edge-secret": "edge-secret-test",
            "cf-connecting-ip": "41.222.10.20",
          }),
        ),
        "41.222.10.20",
      );
      assert.equal(
        visitorIpFromTrustedTrackEdge(
          fakeReq({
            "cf-connecting-ip": "41.222.10.20",
          }),
        ),
        null,
      );
    } finally {
      if (prev === undefined) delete process.env.TRACK_EDGE_SHARED_SECRET;
      else process.env.TRACK_EDGE_SHARED_SECRET = prev;
    }
  });
});
