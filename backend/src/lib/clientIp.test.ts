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

  it("usa cf-connecting-ip quando o XFF é só o hop e há CF-Ray", () => {
    const ip = extractClientIp(
      fakeReq(
        {
          "cf-ray": "8a1b2c3d4e5f6a7b-LIS",
          "cf-connecting-ip": "105.168.1.2",
          "x-forwarded-for": "16.28.17.192",
        },
        { remote: "16.28.17.192" },
      ),
    );
    assert.equal(ip, "105.168.1.2");
  });

  it("ignora X-Client-IP e o endereço à esquerda do XFF", () => {
    const ip = extractClientIp(
      fakeReq(
        {
          "x-client-ip": "1.2.3.4",
          "x-real-ip": "1.2.3.4",
          "true-client-ip": "1.2.3.4",
          "cf-connecting-ip": "1.2.3.4",
          "cf-ray": "spoof",
          "x-forwarded-for": "9.9.9.9, 203.0.113.10, 16.28.17.192",
        },
        { remote: "16.28.17.192" },
      ),
    );
    assert.equal(ip, "203.0.113.10");
  });

  it("ligação directa usa o socket e ignora cabeçalhos", () => {
    const ip = extractClientIp(
      fakeReq(
        { "x-client-ip": "1.2.3.4", "x-vercel-forwarded-for": "8.8.8.8", "x-forwarded-for": "1.2.3.4" },
        { remote: "203.0.113.50" },
      ),
    );
    assert.equal(ip, "203.0.113.50");
  });

  it("peer privado usa o último público do XFF", () => {
    const ip = extractClientIp(
      fakeReq({ "x-forwarded-for": "1.2.3.4, 203.0.113.10" }, { remote: "10.0.0.8" }),
    );
    assert.equal(ip, "203.0.113.10");
  });
});
