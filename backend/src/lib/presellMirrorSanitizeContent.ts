import { parse } from "node-html-parser";
import { sanitizeMirrorUntrustedAnchors } from "./mirrorExternalHosts";
import { sanitizeMirrorSrcDocFromEditor, stripEphemeralMirrorEditMarks } from "./presellMirrorSnapshot";

function sanitizeBuilderHtmlWidgetCode(raw: string, base: URL | null, trustedHosts: string[]): string {
  if (!raw.trim()) return raw;
  try {
    const wrapped = /<html[\s>]/i.test(raw) ? raw : `<div data-ck-wrap="1">${raw}</div>`;
    const root = parse(wrapped, { comment: true });
    root.querySelectorAll("script, object, embed, noscript").forEach((n) => n.remove());
    stripEphemeralMirrorEditMarks(root);
    root.querySelectorAll("*").forEach((el) => {
      const attrs = el.attributes as Record<string, string> | undefined;
      if (!attrs) return;
      for (const name of Object.keys(attrs)) {
        if (/^on/i.test(name)) el.removeAttribute(name);
      }
    });
    sanitizeMirrorUntrustedAnchors(root, {
      base,
      trustedHosts,
      stripUnknownExternal: Boolean(base || trustedHosts.length > 0),
    });
    const wrap = root.querySelector('[data-ck-wrap="1"]');
    return wrap ? wrap.innerHTML : root.toString();
  } catch {
    return raw;
  }
}

function sanitizePageDocumentHtmlWidgets(
  docRaw: unknown,
  base: URL | null,
  trustedHosts: string[],
): unknown {
  if (!docRaw || typeof docRaw !== "object" || Array.isArray(docRaw)) return docRaw;
  const doc = docRaw as Record<string, unknown>;
  if (!Array.isArray(doc.sections)) return docRaw;

  let changed = false;
  const sections = doc.sections.map((section) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) return section;
    const sec = section as Record<string, unknown>;
    if (!Array.isArray(sec.columns)) return section;
    let secChanged = false;
    const columns = sec.columns.map((col) => {
      if (!col || typeof col !== "object" || Array.isArray(col)) return col;
      const colObj = col as Record<string, unknown>;
      if (!Array.isArray(colObj.widgets)) return col;
      let colChanged = false;
      const widgets = colObj.widgets.map((widget) => {
        if (!widget || typeof widget !== "object" || Array.isArray(widget)) return widget;
        const w = widget as Record<string, unknown>;
        if (w.type !== "html" || !w.content || typeof w.content !== "object" || Array.isArray(w.content)) {
          return widget;
        }
        const wc = w.content as Record<string, unknown>;
        if (typeof wc.code !== "string") return widget;
        const cleaned = sanitizeBuilderHtmlWidgetCode(wc.code, base, trustedHosts);
        if (cleaned === wc.code) return widget;
        colChanged = true;
        return { ...w, content: { ...wc, code: cleaned } };
      });
      if (!colChanged) return col;
      secChanged = true;
      return { ...colObj, widgets };
    });
    if (!secChanged) return section;
    changed = true;
    return { ...sec, columns };
  });

  return changed ? { ...doc, sections } : docRaw;
}

function tryHost(raw: string): string | null {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/** Sanitiza espelho e widgets HTML (`importMirrorSrcDoc` e `pageDocument`) antes de persistir. */
export function sanitizeMirrorInContentRecord(content: Record<string, unknown>): Record<string, unknown> {
  const aff = String(content.affiliateLink ?? content.affiliate_link ?? "").trim();
  const baseStr = String(content.sourceUrl ?? content.source_url ?? aff).trim();
  let baseUrl: URL | null = null;
  try {
    if (baseStr) baseUrl = new URL(baseStr);
  } catch {
    baseUrl = null;
  }
  const trustedHosts = [tryHost(aff), tryHost(baseStr)].filter((x): x is string => Boolean(x));

  let next: Record<string, unknown> = content;
  const ensureCopy = () => {
    if (next === content) next = { ...content };
    return next;
  };

  for (const key of ["importMirrorSrcDoc", "import_mirror_src_doc", "mirrorHtml", "mirror_html"] as const) {
    const raw = content[key];
    if (typeof raw !== "string") continue;
    const mirror = raw.trim();
    if (mirror.length <= 200) continue;
    if (!aff && !baseStr) {
      const cleaned = sanitizeBuilderHtmlWidgetCode(mirror, null, []);
      if (cleaned !== raw) ensureCopy()[key] = cleaned;
      continue;
    }
    const cleaned = sanitizeMirrorSrcDocFromEditor(mirror, baseStr || aff, aff || baseStr);
    if (cleaned && cleaned !== raw) {
      ensureCopy()[key] = cleaned;
    }
  }

  for (const docKey of ["pageDocument", "page_document"] as const) {
    if (content[docKey] !== undefined) {
      const cleanedDoc = sanitizePageDocumentHtmlWidgets(content[docKey], baseUrl, trustedHosts);
      if (cleanedDoc !== content[docKey]) {
        ensureCopy()[docKey] = cleanedDoc;
      }
    }
  }

  return next;
}
