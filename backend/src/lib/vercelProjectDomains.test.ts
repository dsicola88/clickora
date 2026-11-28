import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { MULTI_LABEL_PUBLIC_SUFFIXES, dnsRecordNameForHostname, vercelCnameHint } from "./vercelProjectDomains";

describe("dnsRecordNameForHostname", () => {
  it("apex com sufixo de dois níveis (ccTLD) → @", () => {
    for (const h of ["meusite.com.br", "shop.co.uk", "loja.com.au", "oferta.com.mx", "promo.co.za", "x.co.jp", "y.co.in", "z.com.pt", "w.com.es", "v.com.tr"]) {
      assert.equal(dnsRecordNameForHostname(h), "@", h);
    }
  });

  it("apex com TLD simples → @", () => {
    assert.equal(dnsRecordNameForHostname("example.com"), "@");
    assert.equal(dnsRecordNameForHostname("marca.pt"), "@");
    assert.equal(dnsRecordNameForHostname("Example.COM."), "@");
  });

  it("subdomínios devolvem o nome relativo completo", () => {
    assert.equal(dnsRecordNameForHostname("www.example.com"), "www");
    assert.equal(dnsRecordNameForHostname("promo.lp.example.com"), "promo.lp");
    assert.equal(dnsRecordNameForHostname("www.meusite.com.br"), "www");
    assert.equal(dnsRecordNameForHostname("a.b.meusite.com.br"), "a.b");
    assert.equal(dnsRecordNameForHostname("lp.marca.co.uk"), "lp");
  });
});

describe("vercelCnameHint", () => {
  it("apex .com.br → registo A 76.76.21.21 em @", () => {
    const h = vercelCnameHint("meusite.com.br");
    assert.equal(h.host, "@");
    assert.equal(h.target, "76.76.21.21");
  });

  it("subdomínio de vários níveis → CNAME com o nome relativo completo", () => {
    const h = vercelCnameHint("promo.lp.example.com");
    assert.equal(h.host, "promo.lp");
    assert.equal(h.target, "cname.vercel-dns.com");
    assert.match(h.note, /«promo\.lp»/);
    assert.equal(vercelCnameHint("www.meusite.com.br").host, "www");
  });
});

describe("MULTI_LABEL_PUBLIC_SUFFIXES", () => {
  const frontendFile = path.resolve(__dirname, "../../../frontend/src/lib/customDomainDnsDisplay.ts");
  it("está sincronizada com a cópia do frontend", { skip: !existsSync(frontendFile) }, () => {
    const src = readFileSync(frontendFile, "utf8");
    const block = src.match(/MULTI_LABEL_PUBLIC_SUFFIXES[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "";
    const frontendSuffixes = [...block.matchAll(/"([a-z.]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(frontendSuffixes, [...MULTI_LABEL_PUBLIC_SUFFIXES].sort());
  });
});
