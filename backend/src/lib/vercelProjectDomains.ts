/**
 * Integração opcional com a API Vercel: regista o hostname no projeto do site,
 * para o afiliado só precisar de DNS (CNAME + TXT) sem abrir o dashboard Vercel.
 *
 * Env:
 * - VERCEL_TOKEN — token com scope para gerir o projeto
 * - VERCEL_PROJECT_ID — id ou nome do projeto (ex.: prj_… ou nome)
 * - VERCEL_TEAM_ID — opcional, equipa na Vercel
 */

const VERCEL_API = "https://api.vercel.com";

const VERCEL_FETCH_MS = 15_000;

async function vercelFetch(url: string, init: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), VERCEL_FETCH_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

export type VercelVerificationChallenge = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

export function isVercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_TOKEN?.trim() && process.env.VERCEL_PROJECT_ID?.trim());
}

function teamQuery(): string {
  const tid = process.env.VERCEL_TEAM_ID?.trim();
  if (!tid) return "";
  return `?teamId=${encodeURIComponent(tid)}`;
}

function projectBase(): string {
  const id = process.env.VERCEL_PROJECT_ID!.trim();
  return `${VERCEL_API}/v10/projects/${encodeURIComponent(id)}`;
}

function projectBaseV9(): string {
  const id = process.env.VERCEL_PROJECT_ID!.trim();
  return `${VERCEL_API}/v9/projects/${encodeURIComponent(id)}`;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.VERCEL_TOKEN!.trim()}`,
    "Content-Type": "application/json",
  };
}

/** A API Vercel por vezes devolve o domínio dentro de `domain`; os desafios podem usar `name` em vez de `domain`. */
function unwrapProjectDomainPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const inner = d.domain;
  if (inner && typeof inner === "object") {
    return inner as Record<string, unknown>;
  }
  return d;
}

/** Normaliza o array `verification` da Vercel para o formato interno. */
export function normalizeVercelVerificationChallenges(raw: unknown): VercelVerificationChallenge[] {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: VercelVerificationChallenge[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const domain =
      typeof o.domain === "string"
        ? o.domain
        : typeof o.name === "string"
          ? o.name
          : "";
    const value = typeof o.value === "string" ? o.value : "";
    const type = typeof o.type === "string" ? o.type : "TXT";
    const reason = typeof o.reason === "string" ? o.reason : "pending_domain_verification";
    if (!domain || !value) continue;
    out.push({ type, domain, value, reason });
  }
  return out;
}

function parseProjectDomainBody(data: unknown): {
  verified: boolean;
  verification: VercelVerificationChallenge[];
  misconfigured: boolean;
} | null {
  const d = unwrapProjectDomainPayload(data);
  if (!d) return null;
  const verified = typeof d.verified === "boolean" ? d.verified : Boolean(d.verified);
  const verification = normalizeVercelVerificationChallenges(d.verification);
  const misconfigured = d.misconfigured === true;
  return { verified, verification, misconfigured };
}

/**
 * Estado atual do domínio neste projeto (v9).
 * Usado quando o POST de «adicionar» falha mas o hostname já foi registado (retry / falha parcial).
 */
async function vercelFetchProjectDomain(hostname: string): Promise<
  | {
      ok: true;
      verified: boolean;
      verification: VercelVerificationChallenge[];
      misconfigured: boolean;
    }
  | { ok: false; status: number; error?: string }
> {
  const url = `${projectBaseV9()}/domains/${encodeURIComponent(hostname)}${teamQuery()}`;
  let res: Response;
  try {
    res = await vercelFetch(url, { method: "GET", headers: authHeaders() });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: aborted ? "Pedido à Vercel expirou (timeout). Tente de novo." : String(e),
    };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 404) {
    return { ok: false, status: 404 };
  }
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    return {
      ok: false,
      status: res.status,
      error: err.error?.message || `Vercel HTTP ${res.status}`,
    };
  }
  const parsed = parseProjectDomainBody(data);
  if (!parsed) {
    return { ok: false, status: res.status, error: "Resposta inválida da Vercel ao ler o domínio." };
  }
  return {
    ok: true,
    verified: parsed.verified,
    verification: parsed.verification,
    misconfigured: parsed.misconfigured,
  };
}

/** Estado live do domínio no projeto (para go-live / SSL). */
export async function vercelGetProjectDomain(hostname: string): Promise<
  | {
      ok: true;
      verified: boolean;
      verification: VercelVerificationChallenge[];
      misconfigured: boolean;
    }
  | { ok: false; status: number; error?: string }
> {
  if (!isVercelConfigured()) {
    return { ok: false, status: 0, error: "Integração Vercel não configurada." };
  }
  return vercelFetchProjectDomain(hostname);
}

/** Probe HTTPS leve (edge alcançável). Não exige 200 — 3xx/4xx também contam. */
export async function probeHostnameHttps(hostname: string): Promise<boolean> {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8_000);
  try {
    const res = await fetch(`https://${host}/`, {
      method: "GET",
      redirect: "manual",
      signal: ac.signal,
      headers: { "User-Agent": "dclickora-ssl-probe/1" },
    });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

function vercelCreateErrorMessage(
  status: number,
  data: { error?: { message?: string; code?: string } },
): string {
  const code = data.error?.code ?? "";
  const msg = (data.error?.message || "").toLowerCase();
  const combined = `${code} ${msg}`;

  if (
    code === "domain_already_in_use" ||
    combined.includes("already been added") ||
    combined.includes("already exists") ||
    combined.includes("domain is already") ||
    status === 409
  ) {
    return (
      "Este domínio já está ligado a este projeto na Vercel (ou a outro projeto). " +
      "Se acabou de falhar ao guardar no Clickora, tente «Adicionar» de novo — o sistema reaproveita o registo. " +
      "Se o domínio estiver noutro projeto Vercel, remova-o desse projeto ou transfira-o."
    );
  }

  return data.error?.message || `Vercel HTTP ${status}`;
}

/** Regista o domínio no projeto Vercel; devolve desafios TXT e se já está verificado. */
export async function vercelAddProjectDomain(hostname: string): Promise<
  | { ok: true; verified: boolean; verification: VercelVerificationChallenge[] }
  | { ok: false; error: string }
> {
  if (!isVercelConfigured()) {
    return { ok: false, error: "Integração Vercel não configurada no servidor." };
  }
  const url = `${projectBase()}/domains${teamQuery()}`;
  let res: Response;
  try {
    res = await vercelFetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name: hostname }),
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, error: aborted ? "Pedido à Vercel expirou (timeout). Tente de novo." : String(e) };
  }
  const data = (await res.json().catch(() => ({}))) as {
    verified?: boolean;
    verification?: VercelVerificationChallenge[];
    error?: { message?: string; code?: string };
  };

  if (res.ok) {
    const parsed = parseProjectDomainBody(data);
    let verified: boolean;
    let verification: VercelVerificationChallenge[];
    if (parsed) {
      verified = parsed.verified;
      verification = parsed.verification;
    } else {
      const u = unwrapProjectDomainPayload(data);
      verified = Boolean(u && u.verified);
      verification = u ? normalizeVercelVerificationChallenges(u.verification) : [];
    }
    /** Resposta v10 por vezes vem sem `verification`; o GET do mesmo hostname devolve os desafios TXT. */
    if (!verified && verification.length === 0) {
      const refill = await vercelFetchProjectDomain(hostname);
      if (refill.ok) {
        return { ok: true, verified: refill.verified, verification: refill.verification };
      }
    }
    return { ok: true, verified, verification };
  }

  /** Domínio já neste projeto: POST pode falhar; GET devolve o estado (idempotente). */
  const fallback = await vercelFetchProjectDomain(hostname);
  if (fallback.ok) {
    return {
      ok: true,
      verified: fallback.verified,
      verification: fallback.verification,
    };
  }

  if (fallback.status === 404) {
    return { ok: false, error: vercelCreateErrorMessage(res.status, data) };
  }
  if (fallback.error) {
    return { ok: false, error: fallback.error };
  }

  return { ok: false, error: vercelCreateErrorMessage(res.status, data) };
}

/** Pede à Vercel para validar DNS (TXT) e ativar o domínio no projeto. */
export async function vercelVerifyProjectDomain(hostname: string): Promise<
  | { ok: true; verified: boolean }
  | { ok: false; error: string }
> {
  if (!isVercelConfigured()) {
    return { ok: false, error: "Integração Vercel não configurada." };
  }
  const url = `${projectBaseV9()}/domains/${encodeURIComponent(hostname)}/verify${teamQuery()}`;
  let res: Response;
  try {
    res = await vercelFetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: "{}",
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, error: aborted ? "Pedido à Vercel expirou (timeout). Tente de novo." : String(e) };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: { message?: string } };
    return { ok: false, error: err.error?.message || `Vercel HTTP ${res.status}` };
  }
  const parsed = parseProjectDomainBody(data);
  if (parsed) {
    return { ok: true, verified: parsed.verified };
  }
  const flat = data as { verified?: boolean };
  return { ok: true, verified: Boolean(flat.verified) };
}

/** Remove o domínio do projeto (quando o utilizador remove no dclickora). */
export async function vercelRemoveProjectDomain(hostname: string): Promise<{ ok: boolean; error?: string }> {
  if (!isVercelConfigured()) return { ok: true };
  const url = `${projectBaseV9()}/domains/${encodeURIComponent(hostname)}${teamQuery()}`;
  let res: Response;
  try {
    res = await vercelFetch(url, {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, error: aborted ? "Pedido à Vercel expirou (timeout). Tente de novo." : String(e) };
  }
  if (res.status === 404) return { ok: true };
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, error: data.error?.message || `Vercel HTTP ${res.status}` };
  }
  return { ok: true };
}

/**
 * Sufixos públicos de dois níveis mais usados por afiliados (subconjunto da Public Suffix List).
 * Manter igual a `MULTI_LABEL_PUBLIC_SUFFIXES` em `frontend/src/lib/customDomainDnsDisplay.ts`.
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

/** Sugestão de CNAME (ou A no apex) alinhada com a Vercel. */
export function vercelCnameHint(hostname: string): { host: string; target: string; note: string } {
  const sub = dnsRecordNameForHostname(hostname);
  if (sub !== "@") {
    if (sub === "www") {
      return {
        host: "www",
        target: "cname.vercel-dns.com",
        note: "No painel do domínio, aponte «www» para cname.vercel-dns.com.",
      };
    }
    return {
      host: sub,
      target: "cname.vercel-dns.com",
      note: `No painel do domínio, aponte «${sub}» para cname.vercel-dns.com.`,
    };
  }
  return {
    host: "@",
    target: "76.76.21.21",
    note: "No domínio raiz, aponte para 76.76.21.21 (tipo A ou equivalente no seu painel).",
  };
}
