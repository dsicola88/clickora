import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { extractClientIp, isPrivateOrLocalIp, normalizeClientIp } from "./clientIp";

function fakeReq(headers: Record<string, string>, extras?: { ip?: string; remote?: string }): Request {
  return {
    headers,
    ip: extras?.ip,
    socket: { remoteAddress: extras?.remote || "10.0.0.1" },
  } as unknown as Request;
}

describe("clientIp", () => {
  it("normaliza :ffff:", () => {
    assert.equal(normalizeClientIp("::ffff:8.8.8.8"), "8.8.8.8");
  });

  it("detecta privados", () => {
    assert.equal(isPrivateOrLocalIp("10.1.2.3"), true);
    assert.equal(isPrivateOrLocalIp("192.168.0.1"), true);
    assert.equal(isPrivateOrLocalIp("8.8.8.8"), false);
  });

  it("ignora o hop Railway no XFF e pega o cliente", () => {
    const ip = extractClientIp(
      fakeReq({ "x-forwarded-for": "41.222.10.20, 16.28.17.192" }, { remote: "16.28.17.192" }),
    );
    assert.equal(ip, "41.222.10.20");
  });

  it("prefere x-vercel-forwarded-for ao hop Railway", () => {
    const ip = extractClientIp(
      fakeReq(
        {
          "x-vercel-forwarded-for": "41.222.10.20",
          "x-forwarded-for": "16.28.17.192",
        },
        { remote: "16.28.17.192" },
      ),
    );
    assert.equal(ip, "41.222.10.20");
  });

  it("salta IPs privados no XFF e pega o cliente público", () => {
    const ip = extractClientIp(
      fakeReq(
        { "x-forwarded-for": "10.0.0.5, 41.222.10.20, 16.28.17.192" },
        { remote: "16.28.17.192" },
      ),
    );
    assert.equal(ip, "41.222.10.20");
  });

  it("usa cf-connecting-ip", () => {
    const ip = extractClientIp(
      fakeReq({ "cf-connecting-ip": "105.168.1.2", "x-forwarded-for": "16.28.17.192" }, { remote: "16.28.17.192" }),
    );
    assert.equal(ip, "105.168.1.2");
  });
});
