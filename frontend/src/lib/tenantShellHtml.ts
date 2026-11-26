/**
 * HTML base servido em domínios de assinantes (`/tenant-shell.html`, via `middleware.js`).
 * Mesmo bundle que `index.html`, sem identidade da plataforma no `<head>` inicial:
 * verificação Search Console, título/descrição/OG de marketing, ícones, manifest e hostnames da plataforma.
 */

const STRIPPED_META_NAMES = new Set([
  "google-site-verification",
  "description",
  "keywords",
  "author",
  "apple-mobile-web-app-title",
]);

const STRIPPED_LINK_RELS = new Set(["manifest", "icon", "shortcut icon", "apple-touch-icon"]);

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!m) return null;
  return (m[2] ?? m[3] ?? "").trim().toLowerCase();
}

export function buildTenantShellHtml(indexHtml: string): string {
  let html = indexHtml.replace(/[ \t]*<meta\b[^>]*>[ \t]*\r?\n?/gi, (tag) => {
    const name = attr(tag, "name");
    const property = attr(tag, "property");
    if (name && STRIPPED_META_NAMES.has(name)) return "";
    if (name && name.startsWith("twitter:")) return "";
    if (property && property.startsWith("og:")) return "";
    if (name === "robots") return tag.replace(/content\s*=\s*("[^"]*"|'[^']*')/i, 'content="noindex, nofollow"');
    return tag;
  });

  html = html.replace(/[ \t]*<link\b[^>]*>[ \t]*\r?\n?/gi, (tag) => {
    const rel = attr(tag, "rel");
    return rel && STRIPPED_LINK_RELS.has(rel) ? "" : tag;
  });

  html = html.replace(/<title>[\s\S]*?<\/title>/i, "<title>&#160;</title>");
  /** O shell só é servido em hosts de assinante: a lista de hosts da plataforma não tem uso aqui. */
  html = html.replace(/\[[^\]\n]*\];?\s*\/\*\s*@platform-hosts\s*\*\//g, "[];");
  return html;
}
