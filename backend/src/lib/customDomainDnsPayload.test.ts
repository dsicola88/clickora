import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPendingDnsPayload } from "./customDomainDnsPayload";
import { verificationTxtRecordName, verificationTxtValue } from "./customDomainDns";

const HOST = "loja.marca.com";
const TOKEN = "abc123";

describe("buildPendingDnsPayload — prova de posse obrigatória", () => {
  it("modo dclickora devolve o TXT de posse", () => {
    const p = buildPendingDnsPayload(HOST, TOKEN, { vercel: false, vercelVerification: [], vercelVerifiedImmediately: false });
    assert.equal(p.mode, "dclickora");
    assert.equal((p as { txt_name: string }).txt_name, verificationTxtRecordName(HOST));
    assert.equal((p as { txt_value: string }).txt_value, verificationTxtValue(TOKEN));
  });

  it("modo vercel devolve TAMBÉM o TXT de posse, mesmo que a Vercel já tenha validado o DNS", () => {
    const p = buildPendingDnsPayload(HOST, TOKEN, { vercel: true, vercelVerification: [], vercelVerifiedImmediately: true });
    assert.equal(p.mode, "vercel");
    assert.equal((p as { txt_name: string }).txt_name, "_dclickora-verify.loja.marca.com");
    assert.equal((p as { txt_value: string }).txt_value, "dclickora-verification=abc123");
  });

  it("modo vercel mantém os registos da Vercel e o CNAME", () => {
    const p = buildPendingDnsPayload(HOST, TOKEN, {
      vercel: true,
      vercelVerification: [{ type: "TXT", domain: "_vercel.loja.marca.com", value: "vc-x", reason: "ownership" }] as never,
      vercelVerifiedImmediately: false,
    });
    assert.equal((p as { vercel_txt: unknown[] }).vercel_txt.length, 1);
    assert.ok((p as { cname: { target: string } }).cname.target);
  });
});
