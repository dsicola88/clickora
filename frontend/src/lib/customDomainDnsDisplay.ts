import type { CustomDomainDto, CustomDomainPendingDns } from "@/types/api";

/** Alinhado com `vercelCnameHint` no backend — garante CNAME/A na UI mesmo se `pending_dns` não vier na API. */
export function buildVercelCnameHint(hostname: string): { host: string; target: string; note: string } {
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  if (parts.length >= 3) {
    const sub = parts[0];
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
  "O domínio foi registado no projeto do site. Configure o CNAME (ou A no apex) e o(s) TXT abaixo; depois use «Verificar».";

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
