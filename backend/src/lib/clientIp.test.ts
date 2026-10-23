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

  it("rewrite Vercel→Railway: peer AWS + X-Vercel-Forwarded-For = visitante", () => {
    // 15.240.x é AWS (Cape Town) — o que o Railway vê no socket após o rewrite.
    const ip = extractClientIp(
      fakeReq(
        {
          "x-vercel-forwarded-for": "105.172.181.132",
          "x-forwarded-for": "15.240.70.222",
        },
        { remote: "15.240.70.222" },
      ),
    );
    assert.equal(ip, "105.172.181.132");
  });

  it("rewrite Vercel→Railway sem XFF útil ainda usa o visitante Vercel", () => {
    const ip = extractClientIp(
      fakeReq({ "x-vercel-forwarded-for": "63.124.68.69" }, { remote: "15.240.70.222" }),
    );
    assert.equal(ip, "63.124.68.69");
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

  it("ligação directa usa o socket e ignora cabeçalhos spoofáveis", () => {
    const ip = extractClientIp(
      fakeReq(
        { "x-client-ip": "1.2.3.4", "true-client-ip": "8.8.8.8", "x-forwarded-for": "1.2.3.4" },
        { remote: "203.0.113.50" },
      ),
    );
    assert.equal(ip, "203.0.113.50");
  });

  it("atrás de um nó CDN77 usa o IP do visitante, não o do nó", () => {
    const ip = extractClientIp(
      fakeReq({ "x-forwarded-for": "71.208.226.154, 152.233.47.66" }, { remote: "10.0.0.8" }),
    );
    assert.equal(ip, "71.208.226.154");
  });

  it("nó CDN77 sem hop de visitante continua a ser o nó", () => {
    const ip = extractClientIp(
      fakeReq({ "x-forwarded-for": "152.233.47.66" }, { remote: "10.0.0.8" }),
    );
    assert.equal(ip, "152.233.47.66");
  });

  it("atrás do nó CDN77 o X-Real-IP é quem clicou", () => {
    const uk = extractClientIp(
      fakeReq(
        { "x-forwarded-for": "152.233.47.66", "x-real-ip": "81.2.69.142" },
        { remote: "10.0.0.8" },
      ),
    );
    assert.equal(uk, "81.2.69.142");
    const spoof = extractClientIp(
      fakeReq(
        { "x-forwarded-for": "203.0.113.10, 16.28.17.192", "x-real-ip": "81.2.69.142" },
        { remote: "16.28.17.192" },
      ),
    );
    assert.equal(spoof, "203.0.113.10");
  });

  it("peer privado usa o último público do XFF", () => {
    const ip = extractClientIp(
      fakeReq({ "x-forwarded-for": "1.2.3.4, 203.0.113.10" }, { remote: "10.0.0.8" }),
    );
    assert.equal(ip, "203.0.113.10");
  });
});
