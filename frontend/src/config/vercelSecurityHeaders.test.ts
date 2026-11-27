import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

const vercel = JSON.parse(readFileSync(resolve(__dirname, "../../vercel.json"), "utf8")) as {
  headers: HeaderRule[];
};
const global = vercel.headers.find((h) => h.source === "/(.*)");
const header = (key: string) => global?.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value ?? "";

describe("vercel.json — cabeçalhos de segurança globais", () => {
  it("define nosniff, Referrer-Policy, CSP e Permissions-Policy em todas as rotas", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Content-Security-Policy")).toContain("object-src 'none'");
    expect(header("Content-Security-Policy")).toContain("frame-ancestors 'self'");
    expect(header("Permissions-Policy")).toContain("geolocation=()");
  });

  it("CSP não restringe scripts/estilos/base (pixels do cliente e <base> do espelho continuam a funcionar)", () => {
    const csp = header("Content-Security-Policy");
    expect(csp).not.toMatch(/script-src|default-src|style-src|base-uri|connect-src|img-src/);
  });

  it("Permissions-Policy não bloqueia o que os vídeos embebidos precisam", () => {
    expect(header("Permissions-Policy")).not.toMatch(/autoplay|fullscreen|encrypted-media|picture-in-picture/);
  });
});
