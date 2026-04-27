import { renderToStaticMarkup } from "react-dom/server";
import type { PageDocument } from "./types";
import { PageRenderer } from "./components/PageRenderer";
import { buildTrackingBodyScripts, buildTrackingHeadScripts } from "./tracking";

/**
 * Build a fully self-contained HTML document for download or external hosting.
 * Server-renders the React tree and embeds it in a minimal shell with full SEO meta tags.
 */
export function exportPageToHtml(doc: PageDocument): string {
  const body = renderToStaticMarkup(<PageRenderer doc={doc} device="desktop" />);
  const seo = doc.seo ?? {};
  const title = seo.title || doc.name || "Página";
  const description = seo.description ?? "";
  const ogImage = seo.ogImage ?? "";
  const favicon = seo.favicon ?? "";
  const keywords = seo.keywords ?? "";
  const canonical = seo.canonicalUrl ?? "";
  const noindex = seo.noindex ?? false;
  const twitterCard = ogImage ? "summary_large_image" : "summary";

  const metaTags: string[] = [
    `<meta charset="UTF-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `<title>${escapeHtml(title)}</title>`,
  ];
  if (description) metaTags.push(`<meta name="description" content="${escapeHtml(description)}" />`);
  if (keywords) metaTags.push(`<meta name="keywords" content="${escapeHtml(keywords)}" />`);
  if (noindex) metaTags.push(`<meta name="robots" content="noindex,nofollow" />`);
  if (canonical) metaTags.push(`<link rel="canonical" href="${escapeAttr(canonical)}" />`);
  if (favicon) metaTags.push(`<link rel="icon" href="${escapeAttr(favicon)}" />`);

  // Open Graph
  metaTags.push(`<meta property="og:type" content="${escapeAttr(seo.ogType ?? "website")}" />`);
  metaTags.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  if (description)
    metaTags.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  if (ogImage) metaTags.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
  if (canonical) metaTags.push(`<meta property="og:url" content="${escapeAttr(canonical)}" />`);

  // Twitter
  metaTags.push(`<meta name="twitter:card" content="${twitterCard}" />`);
  metaTags.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  if (description)
    metaTags.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);
  if (ogImage) metaTags.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`);

  const trackingHead = doc.tracking ? buildTrackingHeadScripts(doc.tracking) : "";
  const trackingBody = doc.tracking ? buildTrackingBodyScripts(doc.tracking) : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  ${metaTags.join("\n  ")}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #1a1a1a; }
    img { max-width: 100%; height: auto; }
    @media (max-width: 768px) {
      section > div { flex-direction: column !important; }
      section > div > div { flex-basis: 100% !important; }
    }
  </style>
  ${trackingHead}
</head>
<body>
${body}
${trackingBody}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function downloadHtml(doc: PageDocument, slug: string) {
  const html = exportPageToHtml(doc);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug || "pagina"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
