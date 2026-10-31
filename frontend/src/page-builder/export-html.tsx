import { renderToStaticMarkup } from "react-dom/server";
import { EXPORTED_HTML_SCRIPT_ID } from "./document-import";
import type { PageDocument } from "./types";
import { PageRenderer } from "./components/PageRenderer";
import { buildTrackingBodyScripts, buildTrackingHeadScripts } from "./tracking";
import { PresellPublicLocaleProvider } from "@/lib/presellPublicLocale";
import { htmlLangForLocale, normalizePresellLocale } from "@/lib/presellUiStrings";
import { buildDocumentResponsiveCss } from "./builderPublicCss";
import { normalizePageDocumentResponsive } from "./normalizeResponsive";

/**
 * Build a fully self-contained HTML document for download or external hosting.
 * Server-renders the React tree and embeds it in a minimal shell with full SEO meta tags.
 * CSS media queries empilham colunas no telemóvel sem o autor ajustar à mão.
 */
export function exportPageToHtml(doc: PageDocument, language?: string): string {
  const safeDoc = normalizePageDocumentResponsive(doc);
  const body = renderToStaticMarkup(
    <PresellPublicLocaleProvider language={language}>
      <PageRenderer doc={safeDoc} device="desktop" injectPublicCss={false} />
    </PresellPublicLocaleProvider>,
  );
  const htmlLang = language ? htmlLangForLocale(normalizePresellLocale(language)) : "pt-BR";
  const seo = safeDoc.seo ?? {};
  const title = seo.title || safeDoc.name || "Página";
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
  else
    metaTags.push(
      `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`,
    );
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

  if (canonical && (description || title)) {
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: title,
      description: description || title,
      url: canonical,
      ...(ogImage ? { image: ogImage } : {}),
    }).replace(/</g, "\\u003c");
    metaTags.push(`<script type="application/ld+json">${jsonLd}</script>`);
  }

  const trackingHead = safeDoc.tracking ? buildTrackingHeadScripts(safeDoc.tracking) : "";
  const trackingBody = safeDoc.tracking ? buildTrackingBodyScripts(safeDoc.tracking) : "";

  /** Reimportação: JSON embutido (evita `</script>` no payload). */
  const embeddedDocJson = JSON.stringify(safeDoc).replace(/</g, "\\u003c");

  const responsiveCss = buildDocumentResponsiveCss(safeDoc);

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  ${metaTags.join("\n  ")}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #1a1a1a; overflow-x: clip; }
    img, video, iframe { max-width: 100%; height: auto; }
    section[data-header="1"] { position: sticky; top: 0; z-index: 100; width: 100%; background: inherit; }
    ${responsiveCss}
  </style>
  ${trackingHead}
</head>
<body data-clickora-builder-public="1">
${body}
<script type="application/json" id="${EXPORTED_HTML_SCRIPT_ID}">
${embeddedDocJson}
</script>
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
