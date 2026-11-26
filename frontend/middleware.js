/**
 * Edge Middleware (Vercel): superfície pública por host.
 * — Marketing (dclickora / preview): `robots.txt` indexável; resto segue para a SPA.
 * — Domínios de assinantes / tracking: só landers, páginas legais, `/api` e estáticos.
 *   HTML base neutro (`/tenant-shell.html`, gerado no build), painel SaaS → dclickora,
 *   caminhos desconhecidos → 404 real. Ficheiros de verificação Google só no host dono.
 *
 * Mesma resposta para qualquer User-Agent: nada aqui depende de bot/IP.
 */

const MARKETING_ROBOTS = `# dclickora — site institucional (indexável)
User-agent: *
Allow: /

Sitemap: https://www.dclickora.com/sitemap.xml
`;

const TENANT_ROBOTS = `User-agent: *
Disallow: /
`;

const MAIN_SITE_ORIGIN = "https://www.dclickora.com";
export const TENANT_SHELL_PATH = "/tenant-shell.html";

/** Cada ficheiro de verificação do Search Console só responde no(s) host(s) do respetivo dono. */
const SITE_VERIFICATION_FILES = {
  "googleae3afd87ea0e96cd.html": ["dclickora.com", "www.dclickora.com"],
  "google3501df392bc0f6af.html": ["truefindlab.blog", "www.truefindlab.blog"],
};

/** Páginas legais ligadas a partir das landers (rodapés `/termos`, `/aviso-cookies`…). */
const TENANT_LEGAL_SEGMENTS = new Set(["privacidade", "termos", "aviso-medico", "aviso-cookies"]);

/**
 * 1º segmento do painel / marketing da plataforma. Em host de assinante → dclickora.
 * Segmento único só redireciona se também for reservado como slug (ver `publicPresellBarePath.ts`),
 * para não roubar slugs de presell existentes.
 */
const RESERVED_SINGLE_SEGMENTS = new Set([
  "auth",
  "login",
  "planos",
  "plans",
  "reset-password",
  "presell-para-afiliados",
  "super-presell",
  "rastreamento-afiliados",
  "guia-vendas-afiliados",
  "presell",
  "tracking",
  "resultados",
  "integrations",
  "settings",
  "admin",
  "account",
  "home",
  "presells",
  "plataformas",
  "relatorios",
  "analytics",
  "rotadores",
  "blacklist",
  "url-builder",
  "logs",
  "vendas",
  "campaigns",
  "create-presell",
  "keywords",
  "lessons",
  "agency-ready",
  "setup-assistant",
]);

const PANEL_FIRST_SEGMENTS = new Set([
  ...RESERVED_SINGLE_SEGMENTS,
  "inicio",
  "aulas",
  "agency",
  "pronto-agency",
  "ajuda",
  "conta",
  "campanhas",
  "palavras-chave",
  "radar-demanda",
  "integracoes",
  "configuracoes",
  "dpilot",
]);

const NOT_FOUND_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404</title></head>
<body style="font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#334155"><p>404 — Page not found</p></body></html>
`;

function hostOnly(hostHeader) {
  return String(hostHeader || "")
    .toLowerCase()
    .split(":")[0]
    .trim();
}

function isMainMarketingHost(host) {
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  return host === "dclickora.com" || host === "www.dclickora.com";
}

/** Hosts da própria plataforma (mesma lista que `isMainHost` em `index.html`). */
export function isPlatformHost(host) {
  if (!host) return true;
  if (isMainMarketingHost(host)) return true;
  return host === "clickora.com" || host === "www.clickora.com";
}

function decodeSegment(seg) {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * Decide o que um host de assinante pode servir num dado caminho.
 * @returns {{ kind: "pass" } | { kind: "shell" } | { kind: "panel" } | { kind: "not_found" }}
 */
export function classifyTenantPath(pathname) {
  const raw = String(pathname || "/");
  if (raw.startsWith("/api/") || raw === "/api") return { kind: "pass" };
  if (raw.startsWith("/assets/")) return { kind: "pass" };
  if (/^\/l\/[^/]+\/?$/i.test(raw)) return { kind: "pass" };
  if (raw === "/index.html") return { kind: "shell" };
  if (raw === "/sitemap.xml") return { kind: "not_found" };

  const trimmed = raw.replace(/\/+$/, "") || "/";
  if (trimmed === "/") return { kind: "shell" };

  const parts = trimmed.split("/").filter(Boolean);
  const first = decodeSegment(parts[0] || "").toLowerCase();

  if ((parts[parts.length - 1] || "").includes(".")) return { kind: "pass" };

  if (first === "p") {
    return parts.length === 2 ? { kind: "shell" } : { kind: "not_found" };
  }

  if (parts.length === 1) {
    if (TENANT_LEGAL_SEGMENTS.has(first)) return { kind: "shell" };
    if (RESERVED_SINGLE_SEGMENTS.has(first)) return { kind: "panel" };
    if (first === "api" || first === "assets" || first === "l") return { kind: "not_found" };
    return { kind: "shell" };
  }

  if (PANEL_FIRST_SEGMENTS.has(first)) return { kind: "panel" };
  return { kind: "not_found" };
}

function rewriteTo(request, pathname) {
  return new Response(null, {
    headers: { "x-middleware-rewrite": new URL(pathname, request.url).toString() },
  });
}

function notFound() {
  return new Response(NOT_FOUND_HTML, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default function middleware(request) {
  const url = new URL(request.url);
  const host = hostOnly(request.headers.get("host"));
  const pathname = url.pathname;

  if (pathname === "/robots.txt") {
    const body = isMainMarketingHost(host) ? MARKETING_ROBOTS : TENANT_ROBOTS;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const verificationFile = pathname.slice(1);
  if (/^google[0-9a-f]+\.html$/i.test(verificationFile)) {
    const owners = SITE_VERIFICATION_FILES[verificationFile.toLowerCase()];
    if (owners && owners.includes(host)) return undefined;
    return notFound();
  }

  if (isPlatformHost(host)) return undefined;

  const decision = classifyTenantPath(pathname);
  switch (decision.kind) {
    case "shell":
      return rewriteTo(request, TENANT_SHELL_PATH);
    case "panel":
      return Response.redirect(`${MAIN_SITE_ORIGIN}${pathname}${url.search}`, 308);
    case "not_found":
      return notFound();
    default:
      return undefined;
  }
}

export const config = {
  matcher: ["/((?!api/|assets/).*)"],
};
