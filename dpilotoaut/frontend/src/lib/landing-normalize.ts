/**
 * Normaliza documentos de landing após o parse/imports para alinhar com o padrão
 * `content` (build_dpa) → `settings` plano, e aliases de campos.
 */
import type { LandingDocument, SectionNode, WidgetNode, WidgetType } from "./landing-document";

function mapHeadingTagToLevel(tag: unknown): number | undefined {
  if (typeof tag !== "string") return undefined;
  const m = /^h([1-6])$/i.exec(tag.trim());
  if (m) return Math.min(6, Math.max(1, Number(m[1])));
  return undefined;
}

function coerceNumber(n: unknown, fallback: number): number {
  if (typeof n === "number" && !Number.isNaN(n)) return n;
  if (typeof n === "string" && n.trim() !== "") {
    const v = Number(n);
    if (!Number.isNaN(v)) return v;
  }
  return fallback;
}

function pullContentObject(o: Record<string, unknown>, keys: string[]) {
  const c = o["content"];
  if (!c || typeof c !== "object" || c === null) return;
  const co = c as Record<string, unknown>;
  for (const k of keys) {
    if (o[k] == null && co[k] != null) o[k] = co[k];
  }
  delete o["content"];
}

export function normalizeWidgetSettings(type: WidgetType, settings: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = { ...settings };

  switch (type) {
    case "hero": {
      pullContentObject(o, [
        "title",
        "subtitle",
        "primaryCtaLabel",
        "primaryCtaHref",
        "secondaryCtaLabel",
        "secondaryCtaHref",
        "align",
      ]);
      break;
    }
    case "heading": {
      {
        const c = o["content"];
        if (c && typeof c === "object" && c !== null) {
          const co = c as Record<string, unknown>;
          if (o.text == null && typeof co.text === "string") o.text = co.text;
          if (o.level == null) {
            const lv = mapHeadingTagToLevel(co.tag);
            if (lv != null) o.level = lv;
          }
          if (o.align == null && typeof co.align === "string") o.align = co.align;
          delete o["content"];
        }
      }
      if (o.level == null) {
        const lv = mapHeadingTagToLevel(o.tag);
        if (lv != null) o.level = lv;
      }
      if (o.level == null) o.level = 2;
      else o.level = Math.min(6, Math.max(1, coerceNumber(o.level, 2)));
      if (o.tag != null) delete o.tag;
      break;
    }
    case "text": {
      {
        const c = o["content"];
        if (c && typeof c === "object" && c !== null) {
          const co = c as Record<string, unknown>;
          if (o.body == null && typeof co.html === "string") o.body = co.html;
          if (o.align == null && typeof co.align === "string") o.align = co.align;
          delete o["content"];
        }
      }
      if (o.body == null && typeof o.html === "string") o.body = o.html;
      if (o.html != null) delete o.html;
      break;
    }
    case "image": {
      {
        const c = o["content"];
        if (c && typeof c === "object" && c !== null) {
          const co = c as Record<string, unknown>;
          if (o.src == null && typeof co.src === "string") o.src = co.src;
          if (o.alt == null && typeof co.alt === "string") o.alt = co.alt;
          if (o.link == null && typeof co.link === "string") o.link = co.link;
          delete o["content"];
        }
      }
      if (o.src == null && typeof o.url === "string") o.src = o.url;
      if (o.url != null) delete o.url;
      break;
    }
    case "button": {
      {
        const c = o["content"];
        if (c && typeof c === "object" && c !== null) {
          const co = c as Record<string, unknown>;
          if (o.label == null && typeof co.text === "string") o.label = co.text;
          if (o.href == null && typeof co.href === "string") o.href = co.href;
          if (o.target == null && typeof co.target === "string") o.target = co.target;
          delete o["content"];
        }
      }
      if (o.label == null && typeof o.text === "string") o.label = o.text;
      if (o.text != null) delete o.text;
      break;
    }
    case "html": {
      {
        const c = o["content"];
        if (c && typeof c === "object" && c !== null) {
          const co = c as Record<string, unknown>;
          if (o.html == null && typeof co.code === "string") o.html = co.code;
          if (o.html == null && typeof co.html === "string") o.html = co.html;
          delete o["content"];
        }
      }
      if (o.html == null && typeof o.code === "string") o.html = o.code;
      if (o.code != null) delete o.code;
      break;
    }
    case "spacer": {
      if (o.height == null) {
        const st = settings["styles"] as Record<string, unknown> | undefined;
        const h = st?.["height"] as { desktop?: string } | string | undefined;
        if (typeof h === "object" && h != null && typeof h.desktop === "string") {
          const n = parseInt(h.desktop, 10);
          if (!Number.isNaN(n)) o.height = n;
        } else if (typeof h === "string") {
          const n = parseInt(h, 10);
          if (!Number.isNaN(n)) o.height = n;
        }
      }
      o.height = coerceNumber(o.height, 24);
      break;
    }
    case "divider":
    case "pricing":
    case "icon_list":
    case "video":
    case "accordion":
    case "testimonial":
    case "embed":
    case "columns":
    case "gallery":
    case "form":
    case "countdown":
      break;
    default:
      break;
  }

  // ui: strip unknown but keep as passthrough
  if (o.ui && typeof o.ui === "object" && o.ui !== null) {
    o.ui = { ...(o.ui as object) };
  }
  return o;
}

export function normalizeWidgetNode(w: WidgetNode): WidgetNode {
  return { ...w, settings: normalizeWidgetSettings(w.type, w.settings as Record<string, unknown>) as WidgetNode["settings"] };
}

export function normalizeSectionNode(s: SectionNode): SectionNode {
  return { ...s, children: s.children.map(normalizeWidgetNode) };
}

export function normalizeLandingDocument(doc: LandingDocument): LandingDocument {
  return { ...doc, sections: doc.sections.map(normalizeSectionNode) };
}
