/**
 * O espelho público corre em iframe sandbox sem `allow-scripts`.
 * Muitas sales pages escondem o DOM até JS remover `.async-hide` / `wf-loading` — fica ecrã branco.
 */

const FOUC_CLASS_NAMES = new Set([
  "async-hide",
  "wf-loading",
  "js-loading",
  "loading-state",
  "hold-transition",
  "page-loading",
]);

const FOUC_RULE_PATTERNS: RegExp[] = [
  /\.async-hide\s*\{[^}]*\}/gi,
  /\.wf-loading\s+body\s*\{[^}]*\}/gi,
  /html\.wf-loading\s*\{[^}]*\}/gi,
  /body\.wf-loading\s*\{[^}]*\}/gi,
  /\.js-loading\s*\{[^}]*\}/gi,
];

const UNLOCK_STYLE =
  '<style data-clickora-mirror-unlock="1">' +
  "html,body,.async-hide,.wf-loading,.js-loading,.loading-state{opacity:1!important;visibility:visible!important;display:block!important}" +
  "</style>";

function stripFoucFromClassAttr(attrs: string): string {
  if (!/\bclass\s*=/i.test(attrs)) return attrs;
  return attrs.replace(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i, (_full, q: string, cls: string) => {
    const next = cls
      .split(/\s+/)
      .filter((token) => token && !FOUC_CLASS_NAMES.has(token.toLowerCase()))
      .join(" ");
    return next ? ` class=${q}${next}${q}` : "";
  });
}

export function unlockMirrorHtmlForSandboxIframe(html: string): string {
  if (!html || html.length < 40) return html;
  let out = html;
  for (const re of FOUC_RULE_PATTERNS) {
    out = out.replace(re, (rule) => {
      if (!/opacity\s*:\s*0|visibility\s*:\s*hidden|display\s*:\s*none/i.test(rule)) return rule;
      return rule.replace(
        /opacity\s*:\s*[^;!]+/gi,
        "opacity:1!important",
      ).replace(
        /visibility\s*:\s*[^;!]+/gi,
        "visibility:visible!important",
      ).replace(
        /display\s*:\s*none/gi,
        "display:block",
      );
    });
  }
  out = out.replace(/<html\b([^>]*)>/i, (full, attrs: string) => `<html${stripFoucFromClassAttr(attrs)}>`);
  out = out.replace(/<body\b([^>]*)>/i, (full, attrs: string) => `<body${stripFoucFromClassAttr(attrs)}>`);
  if (/<head[\s>]/i.test(out)) {
    out = out.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${UNLOCK_STYLE}`);
  } else if (/<html[\s>]/i.test(out)) {
    out = out.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head>${UNLOCK_STYLE}</head>`);
  } else {
    out = UNLOCK_STYLE + out;
  }
  return out;
}