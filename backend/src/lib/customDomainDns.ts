import { randomBytes } from "node:crypto";
import dns from "node:dns/promises";

const TXT_PREFIX = "dclickora-verification=";

/** Normaliza input do utilizador para FQDN em minúsculas. */
export function normalizeHostname(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  s = s.split("/")[0] ?? "";
  s = s.split(":")[0] ?? "";
  s = s.replace(/\.$/, "");
  return s;
}

const BLOCKED = new Set([
  "dclickora.com",
  "www.dclickora.com",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

function isBlocked(hostname: string): boolean {
  if (BLOCKED.has(hostname)) return true;
  if (hostname.endsWith(".vercel.app") || hostname.endsWith(".railway.app")) return true;
  if (hostname.endsWith(".dclickora.com")) return true;
  return false;
}

/** Valida formato; não garante que o domínio existe. */
export function validateHostnameOrThrow(hostname: string): void {
  if (!hostname || hostname.length > 253) {
    throw new Error("Hostname inválido.");
  }
  if (isBlocked(hostname)) {
    throw new Error("Este hostname não pode ser usado como domínio personalizado.");
  }
  // Evita caminhos / query colados por engano
  if (hostname.includes("/") || hostname.includes("?") || hostname.includes(" ")) {
    throw new Error("Use só o domínio (ex.: www.seusite.com), sem https ou caminhos.");
  }
  const labels = hostname.split(".");
  if (labels.length < 2) {
    throw new Error("Indique um domínio completo (ex.: www.seusite.com ou seusite.com).");
  }
  for (const part of labels) {
    if (!part.length || part.length > 63) throw new Error("Hostname inválido.");
  }
}

export function newVerificationToken(): string {
  return randomBytes(24).toString("hex");
}

/** Nome DNS completo do registo TXT de verificação. */
export function verificationTxtRecordName(hostname: string): string {
  return `_dclickora-verify.${hostname}`;
}

export function verificationTxtValue(token: string): string {
  return `${TXT_PREFIX}${token}`;
}

/** Limite para não ultrapassar timeouts de proxy (Vercel → Railway) durante «Verificar». */
const DNS_TXT_LOOKUP_MS = 8000;

export type DnsTxtVerificationResult = "match" | "no_match" | "timeout";

export async function dnsTxtContainsVerification(
  hostname: string,
  token: string,
): Promise<DnsTxtVerificationResult> {
  const name = verificationTxtRecordName(hostname);
  const expected = verificationTxtValue(token);

  const lookup = async (): Promise<DnsTxtVerificationResult> => {
    try {
      const chunks = await dns.resolveTxt(name);
      const joined = chunks.map((c) => c.join("")).join("");
      return joined.includes(expected) ? "match" : "no_match";
    } catch {
      return "no_match";
    }
  };

  const timeout = new Promise<DnsTxtVerificationResult>((resolve) => {
    setTimeout(() => resolve("timeout"), DNS_TXT_LOOKUP_MS);
  });

  return Promise.race([lookup(), timeout]);
}
