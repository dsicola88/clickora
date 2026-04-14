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

function parseProjectDomainBody(data: unknown): {
  verified: boolean;
  verification: VercelVerificationChallenge[];
} | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const verified = typeof d.verified === "boolean" ? d.verified : Boolean(d.verified);
  const raw = d.verification;
  const verification = Array.isArray(raw) ? (raw as VercelVerificationChallenge[]) : [];
  return { verified, verification };
}

/**
 * Estado atual do domínio neste projeto (v9).
 * Usado quando o POST de «adicionar» falha mas o hostname já foi registado (retry / falha parcial).
 */
async function vercelFetchProjectDomain(hostname: string): Promise<
  | { ok: true; verified: boolean; verification: VercelVerificationChallenge[] }
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
  return { ok: true, verified: parsed.verified, verification: parsed.verification };
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
    if (parsed) {
      return {
        ok: true,
        verified: parsed.verified,
        verification: parsed.verification,
      };
    }
    return {
      ok: true,
      verified: Boolean(data.verified),
      verification: Array.isArray(data.verification) ? data.verification : [],
    };
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
  const data = (await res.json().catch(() => ({}))) as {
    verified?: boolean;
    error?: { message?: string };
  };
  if (!res.ok) {
    return { ok: false, error: data.error?.message || `Vercel HTTP ${res.status}` };
  }
  return { ok: true, verified: Boolean(data.verified) };
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

/** Sugestão de CNAME (ou A no apex) alinhada com a Vercel. */
export function vercelCnameHint(hostname: string): { host: string; target: string; note: string } {
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
