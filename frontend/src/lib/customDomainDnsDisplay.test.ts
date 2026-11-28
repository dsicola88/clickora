import { describe, expect, it } from "vitest";
import { buildVercelCnameHint, dnsRecordNameForHostname, resolvePendingDnsForDisplay } from "./customDomainDnsDisplay";
import type { CustomDomainDto } from "@/types/api";

describe("buildVercelCnameHint — domínio registável com sufixos de dois níveis", () => {
  it("apex .com.br / .co.uk → A 76.76.21.21 em @", () => {
    for (const h of ["meusite.com.br", "shop.co.uk", "loja.com.au", "promo.co.za", "z.com.pt"]) {
      const hint = buildVercelCnameHint(h);
      expect(hint.host, h).toBe("@");
      expect(hint.target, h).toBe("76.76.21.21");
    }
    expect(buildVercelCnameHint("example.com").host).toBe("@");
  });

  it("subdomínio de vários níveis → CNAME com o nome relativo completo", () => {
    const hint = buildVercelCnameHint("promo.lp.example.com");
    expect(hint.host).toBe("promo.lp");
    expect(hint.target).toBe("cname.vercel-dns.com");
    expect(buildVercelCnameHint("www.meusite.com.br").host).toBe("www");
    expect(dnsRecordNameForHostname("a.b.meusite.com.br")).toBe("a.b");
    expect(dnsRecordNameForHostname("lp.marca.co.uk")).toBe("lp");
  });
});

const base = {
  id: "d1",
  hostname: "loja.marca.com",
  verification_token: "tok123",
  status: "pending",
  verified_at: null,
  is_default: false,
  vercel_domain_registered: true,
} as unknown as CustomDomainDto;

describe("resolvePendingDnsForDisplay — prova de posse em modo Vercel", () => {
  it("resposta completa da API mantém o TXT de posse devolvido", () => {
    const p = resolvePendingDnsForDisplay({
      ...base,
      pending_dns: {
        mode: "vercel",
        cname: { host: "loja", target: "cname.vercel-dns.com", note: "" },
        vercel_txt: [],
        txt_name: "_dclickora-verify.loja.marca.com",
        txt_value: "dclickora-verification=tok123",
        vercel_verified_immediately: false,
        note: "",
      },
    });
    expect(p?.mode).toBe("vercel");
    expect(p && "txt_value" in p ? p.txt_value : null).toBe("dclickora-verification=tok123");
  });

  it("API sem txt_name (proxy antigo) → o cartão calcula o TXT a partir do token", () => {
    const p = resolvePendingDnsForDisplay({
      ...base,
      pending_dns: {
        mode: "vercel",
        cname: { host: "loja", target: "cname.vercel-dns.com", note: "" },
        vercel_txt: [],
        vercel_verified_immediately: false,
        note: "",
      } as never,
    });
    expect(p && "txt_name" in p ? p.txt_name : null).toBe("_dclickora-verify.loja.marca.com");
    expect(p && "txt_value" in p ? p.txt_value : null).toBe("dclickora-verification=tok123");
  });

  it("sem pending_dns em domínio registado na Vercel → TXT de posse presente", () => {
    const p = resolvePendingDnsForDisplay({ ...base });
    expect(p?.mode).toBe("vercel");
    expect(p && "txt_value" in p ? p.txt_value : null).toBe("dclickora-verification=tok123");
  });

  it("domínio já verificado não mostra cartão pendente", () => {
    expect(resolvePendingDnsForDisplay({ ...base, status: "verified" } as CustomDomainDto)).toBeNull();
  });
});
