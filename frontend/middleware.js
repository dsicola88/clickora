/**
 * Edge Middleware (Vercel): `robots.txt` por host.
 * — Marketing (dclickora / preview): Allow páginas públicas, Disallow /p/ e app
 * — Domínios de assinantes / tracking: Disallow total
 *
 * Landers `/p/*` também recebem X-Robots-Tag via vercel.json + meta noindex no SPA.
 */

const MARKETING_ROBOTS = `# dclickora — site de marketing (indexável)
User-agent: Googlebot
Allow: /
Disallow: /p/
Disallow: /api/
Disallow: /inicio
Disallow: /presells
Disallow: /settings
Disallow: /integracoes
Disallow: /tracking
Disallow: /rotadores
Disallow: /urls
Disallow: /admin

User-agent: Bingbot
Allow: /
Disallow: /p/
Disallow: /api/
Disallow: /inicio
Disallow: /presells
Disallow: /settings
Disallow: /integracoes
Disallow: /tracking
Disallow: /rotadores
Disallow: /urls
Disallow: /admin

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
Disallow: /p/
Disallow: /api/
Disallow: /inicio
Disallow: /presells
Disallow: /settings
Disallow: /integracoes
Disallow: /tracking
Disallow: /rotadores
Disallow: /urls
Disallow: /admin

Sitemap: https://www.dclickora.com/sitemap.xml
`;

const TENANT_ROBOTS = `# Domínio de assinante / tracking — não indexar
# Site público: https://www.dclickora.com
User-agent: *
Disallow: /
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

export default function middleware(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/robots.txt") {
    return undefined;
  }

  const host = hostOnly(request.headers.get("host"));
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

export const config = {
  matcher: ["/robots.txt"],
};
