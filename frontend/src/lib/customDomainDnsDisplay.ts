import type { CustomDomainDto, CustomDomainPendingDns } from "@/types/api";

/**
 * Sufixos públicos de dois níveis mais usados por afiliados (subconjunto da Public Suffix List).
 * Manter igual a `MULTI_LABEL_PUBLIC_SUFFIXES` em `backend/src/lib/vercelProjectDomains.ts`.
 */
export const MULTI_LABEL_PUBLIC_SUFFIXES: ReadonlySet<string> = new Set([
  // Brasil
  "com.br", "net.br", "org.br", "app.br", "art.br", "blog.br", "dev.br", "eco.br", "emp.br", "eng.br",
  "ind.br", "inf.br", "log.br", "med.br", "nom.br", "ong.br", "pro.br", "rec.br", "srv.br", "tec.br",
  "tur.br", "tv.br", "vlog.br", "wiki.br", "adv.br", "arq.br", "psi.br", "seg.br", "edu.br", "gov.br",
  // Reino Unido
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk", "ac.uk", "gov.uk",
  // Austrália / Nova Zelândia
  "com.au", "net.au", "org.au", "id.au", "asn.au", "edu.au", "gov.au",
  "co.nz", "net.nz", "org.nz", "ac.nz", "gen.nz", "school.nz", "govt.nz",
  // América Latina
  "com.mx", "net.mx", "org.mx", "edu.mx", "gob.mx",
  "com.ar", "net.ar", "org.ar", "edu.ar", "gob.ar",
  "com.co", "net.co", "org.co", "edu.co", "gov.co",
  "com.pe", "net.pe", "org.pe", "com.cl", "com.uy", "com.py", "com.bo", "com.ec", "com.ve",
  "com.gt", "com.do", "com.sv", "com.pa", "co.cr",
  // África do Sul / Japão / Índia
  "co.za", "net.za", "org.za", "web.za", "ac.za", "gov.za",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp", "gr.jp",
  "co.in", "net.in", "org.in", "firm.in", "gen.in", "ind.in", "ac.in", "edu.in", "gov.in",
  // Europa
  "com.pt", "org.pt", "edu.pt", "gov.pt",
  "com.es", "nom.es", "org.es", "edu.es", "gob.es",
  "com.tr", "net.tr", "org.tr", "biz.tr", "info.tr", "gen.tr", "web.tr", "edu.tr", "gov.tr",
  "com.pl", "net.pl", "org.pl", "com.ua", "co.il", "org.il",
  // Ásia / outros
  "com.cn", "net.cn", "org.cn", "com.hk", "com.tw", "com.sg", "com.my", "co.id", "co.th", "com.ph",
  "co.kr", "com.vn", "com.pk", "com.sa", "com.eg", "com.ng", "co.ke",
]);

/** Nome relativo do registo DNS na zona do domínio registável (`@` no apex, `promo.lp` em `promo.lp.example.com`). */
export function dnsRecordNameForHostname(hostname: string): string {
  const parts = hostname.trim().toLowerCase().replace(/\.+$/, "").split(".").filter(Boolean);
  const suffixLabels = parts.length >= 3 && MULTI_LABEL_PUBLIC_SUFFIXES.has(parts.slice(-2).join(".")) ? 2 : 1;
  const registrableLabels = suffixLabels + 1;
  if (parts.length <= registrableLabels) return "@";
  return parts.slice(0, parts.length - registrableLabels).join(".");
}

/** Alinhado com `vercelCnameHint` no backend — garante CNAME/A na UI mesmo se `pending_dns` não vier na API. */
export function buildVercelCnameHint(hostname: string): { host: string; target: string; note: string } {
  const sub = dnsRecordNameForHostname(hostname);
  if (sub !== "@") {
    if (sub === "www") {
      return {
        host: "www",
        target: "cname.vercel-dns.com",
        note:
          "No painel DNS, crie um CNAME de «www» (ou o nome completo indicado pelo registrador) para cname.vercel-dns.com.",
      };
    }
    return {
      host: sub,
      target: "cname.vercel-dns.com",
      note: `Crie um CNAME do nome «${sub}» para cname.vercel-dns.com (ajuste ao formato do seu DNS).`,
    };
  }
  return {
    host: "@",
    target: "76.76.21.21",
    note:
      "Para domínio raiz (apex), use registo A para 76.76.21.21 ou ALIAS/ANAME conforme o registrador; veja a documentação Vercel.",
  };
}

const VERCEL_PENDING_NOTE =
  "O domínio foi registado no projeto do site. Configure o CNAME (ou A no apex), o TXT de posse (_dclickora-verify) e o(s) TXT da Vercel abaixo; depois use «Verificar».";

/** Tipo de registo DNS para exibição (alinhado à Vercel: apex → A 76.76.21.21, subdomínio → CNAME). */
export function inferDnsRecordKind(target: string): "A" | "CNAME" {
  const t = target.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return "A";
  return "CNAME";
}

export function normalizeDomainStatus(raw: string | undefined): "pending" | "verified" {
  const s = String(raw ?? "").toLowerCase();
  if (s === "verified") return "verified";
  return "pending";
}

/** TXT de posse `_dclickora-verify`: exigido em qualquer modo antes de o domínio ficar verificado. */
function ownershipTxt(hostname: string, verificationToken: string): { txt_name: string; txt_value: string } {
  return {
    txt_name: `_dclickora-verify.${hostname}`,
    txt_value: verificationToken ? `dclickora-verification=${verificationToken}` : "",
  };
}

function buildLegacyDclickoraDns(hostname: string, verificationToken: string): Extract<CustomDomainPendingDns, { mode: "dclickora" }> {
  return {
    mode: "dclickora",
    txt_name: `_dclickora-verify.${hostname}`,
    txt_value: `dclickora-verification=${verificationToken}`,
    note:
      "Crie um único registo TXT: use a primeira linha como Nome/Host e a segunda como Valor. Depois clique em «Verificar agora».",
  };
}

function isCompletePendingDns(p: CustomDomainPendingDns): boolean {
  if (p.mode === "vercel") {
    return Boolean(p.cname?.host && p.cname?.target && Array.isArray(p.vercel_txt));
  }
  return Boolean(p.txt_name && p.txt_value);
}

/**
 * Garante sempre um `pending_dns` utilizável no cartão «Pendente», mesmo se a API omitir campos
 * (proxy antigo, cache, ou resposta parcial).
 */
export function resolvePendingDnsForDisplay(d: CustomDomainDto): CustomDomainPendingDns | null {
  if (normalizeDomainStatus(d.status) !== "pending") return null;

  const hint = buildVercelCnameHint(d.hostname);
  const token = d.verification_token?.trim() ?? "";

  const api = d.pending_dns;
  if (api && isCompletePendingDns(api)) {
    if (api.mode === "vercel") {
      const cname =
        api.cname?.host && api.cname?.target ? api.cname : hint;
      return {
        ...api,
        cname,
        vercel_txt: Array.isArray(api.vercel_txt) ? api.vercel_txt : [],
        ...(api.txt_name && api.txt_value ? {} : ownershipTxt(d.hostname, token)),
        note: api.note || VERCEL_PENDING_NOTE,
      };
    }
    return api;
  }

  if (api?.mode === "vercel") {
    return {
      mode: "vercel",
      cname: api.cname?.host && api.cname?.target ? api.cname : hint,
      vercel_txt: Array.isArray(api.vercel_txt) ? api.vercel_txt : [],
      ...ownershipTxt(d.hostname, token),
      vercel_verified_immediately: Boolean(api.vercel_verified_immediately),
      note: api.note || VERCEL_PENDING_NOTE,
    };
  }

  if (api?.mode === "dclickora" && (!api.txt_name || !api.txt_value) && token) {
    return buildLegacyDclickoraDns(d.hostname, token);
  }

  if (d.vercel_domain_registered) {
    return {
      mode: "vercel",
      cname: hint,
      vercel_txt: [],
      ...ownershipTxt(d.hostname, token),
      vercel_verified_immediately: false,
      note: VERCEL_PENDING_NOTE,
    };
  }

  if (!token) {
    return {
      mode: "dclickora",
      txt_name: `_dclickora-verify.${d.hostname}`,
      txt_value: "",
      note: "Atualize a página (F5). Se o token continuar em falta, remova o domínio e adicione de novo.",
    };
  }

  return buildLegacyDclickoraDns(d.hostname, token);
}

/** Referência CNAME/A para domínio verificado com Vercel (API ou cálculo local). */
export function resolveHostingDnsHint(d: CustomDomainDto): { host: string; target: string; note: string } | null {
  if (normalizeDomainStatus(d.status) !== "verified") return null;
  if (!d.vercel_domain_registered) return null;
  return d.hosting_dns_hint ?? buildVercelCnameHint(d.hostname);
}
