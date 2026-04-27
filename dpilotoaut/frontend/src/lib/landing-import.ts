/**
 * Importa JSON nativo da landing (`version: 1`) ou documento `build_dpa` (secções com `columns`).
 * Cada widget é passado por `normalizeWidgetNode` no fim.
 */
import {
  getDefaultFormSettings,
  getDefaultLandingDocument,
  newId,
  normalizeLandingDocument,
  normalizeWidgetNode,
  parseLandingDocument,
  type LandingDocument,
  type SectionNode,
  type WidgetNode,
  type WidgetType,
} from "./landing-document";

function isBuildDpaPageDocument(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const sections = o.sections;
  if (!Array.isArray(sections) || sections.length === 0) return false;
  const s0 = sections[0];
  if (!s0 || typeof s0 !== "object") return false;
  const sec = s0 as Record<string, unknown>;
  return Array.isArray(sec.columns);
}

/** Remove chaves só do build_dpa após `normalize` (o normalizador de spacer precisa de `styles` antes disto). */
function finishImportWidget(n: WidgetNode): WidgetNode {
  const s = { ...(n.settings as Record<string, unknown>) };
  delete s.styles;
  if ("content" in s) delete s["content"];
  return { ...n, settings: s as WidgetNode["settings"] };
}

function mapDpaTypeToLanding(t: string): WidgetType {
  const m: Record<string, WidgetType> = {
    heading: "heading",
    text: "text",
    image: "image",
    button: "button",
    video: "video",
    spacer: "spacer",
    icon: "icon_list",
    divider: "divider",
    html: "html",
    form: "form",
    testimonials: "testimonial",
    faq: "accordion",
    countdown: "countdown",
    gallery: "gallery",
    animatedHeadline: "html",
    priceTable: "html",
    ctaBox: "html",
    flipBox: "html",
    progressTracker: "html",
  };
  return m[t] ?? "html";
}

function galleryToHtml(content: Record<string, unknown>): string {
  const images = (content.images as { src?: string; alt?: string }[]) ?? [];
  if (images.length === 0) return "<p class=\"lp-import-fallback\">Galeria (vazia após import)</p>";
  const cells = images
    .map((im) => {
      const src = String(im?.src ?? "");
      const alt = String(im?.alt ?? "").replace(/"/g, "&quot;");
      return src ? `<div><img src="${src.replace(/"/g, "&quot;")}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px" loading="lazy" /></div>` : "";
    })
    .filter(Boolean);
  return `<div class="lp-import-gallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">${cells.join("")}</div>`;
}

function animatedHeadlineToHtml(content: Record<string, unknown>): string {
  const pre = String(content.prefix ?? "");
  const suf = String(content.suffix ?? "");
  const words = (content.rotatingWords as string[]) ?? [];
  const w = words.length ? ` ${words[0]}` : "";
  return `<h2 class="lp-import-animated text-2xl font-bold" style="text-align:center">${pre}${w} ${suf}</h2><p class="text-xs text-center text-muted-foreground">(Título animado: palavras rotativas reduzidas à primeira; edite o HTML se precisar.)</p>`;
}

function priceTableToHtml(content: Record<string, unknown>): string {
  const title = String(content.title ?? "Plano");
  const price = String(content.price ?? "—");
  const period = String(content.period ?? "");
  const cur = String(content.currency ?? "");
  const cta = String(content.ctaText ?? "Subscrever");
  const href = String(content.ctaHref ?? "#");
  const feats = (content.features as { text?: string; included?: boolean }[]) ?? [];
  const fl = feats
    .filter((f) => f.included)
    .map((f) => `<li>${String(f.text ?? "")}</li>`)
    .join("");
  return `<div class="lp-import-price border rounded-lg p-6 max-w-sm mx-auto"><h3 class="text-xl font-semibold">${title}</h3><p class="text-3xl font-bold mt-2">${cur}${price}<span class="text-base font-normal">${period}</span></p><ul class="list-disc pl-5 my-4 space-y-1 text-sm">${fl}</ul><a class="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md" href="${href.replace(/"/g, "&quot;")}">${cta}</a></div>`;
}

function ctaBoxToHtml(content: Record<string, unknown>): string {
  const title = String(content.title ?? "");
  const d = String(content.description ?? "");
  const p1 = String(content.primaryText ?? "CTA");
  const h1 = String(content.primaryHref ?? "#");
  return `<section class="lp-import-ctabox rounded-2xl p-8 my-4 text-center" style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff"><h2 class="text-2xl font-bold">${title}</h2><p class="mt-2 opacity-90">${d}</p><a class="inline-block mt-4 px-6 py-3 rounded-md font-medium" style="background:#e63946;color:#fff" href="${h1.replace(/"/g, "&quot;")}">${p1}</a></section>`;
}

function flipBoxToHtml(content: Record<string, unknown>): string {
  const ft = String(content.frontTitle ?? "");
  const b = String(content.backDescription ?? "");
  return `<div class="lp-import-flip border rounded-lg p-6 my-2"><h3 class="font-semibold">${ft}</h3><p class="text-sm text-muted-foreground mt-2">${b}</p></div>`;
}

function progressToHtml(content: Record<string, unknown>): string {
  const items = (content.items as { label?: string; value?: number }[]) ?? [];
  return `<div class="lp-import-progress space-y-2 text-sm">${items.map((i) => `<div class="flex justify-between gap-2"><span>${String(i.label ?? "")}</span><span class="text-muted-foreground">${Number(i.value ?? 0)}%</span></div>`).join("")}</div>`;
}

function testimonialsToHtml(content: Record<string, unknown>): string {
  const items = (content.items as { name?: string; quote?: string }[]) ?? [];
  return `<div class="lp-import-testimonials space-y-4">${items.map((t) => `<blockquote class="border-l-2 pl-3 italic">${String(t.quote ?? "")}</blockquote><p class="text-sm font-medium">— ${String(t.name ?? "")}</p>`).join("")}</div>`;
}

function faqToHtml(content: Record<string, unknown>): string {
  const items = (content.items as { question?: string; answer?: string }[]) ?? [];
  return `<div class="lp-import-faq space-y-2">${items.map((q) => `<div class="border-b py-2"><p class="font-medium">${String(q.question ?? "")}</p><div class="text-sm text-muted-foreground mt-1">${String(q.answer ?? "")}</div></div>`).join("")}</div>`;
}

function dpaToPlainObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

function convertDpaWidget(w: unknown): WidgetNode {
  const o = dpaToPlainObject(w);
  const dpaType = String(o.type ?? "html");
  const content = dpaToPlainObject(o.content);
  const id = typeof o.id === "string" && o.id ? o.id : newId();
  const css = typeof o.cssClasses === "string" ? o.cssClasses : undefined;

  const landingType = mapDpaTypeToLanding(dpaType);

  if (dpaType === "video") {
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "video",
        settings: {
          url: String(content.url ?? ""),
          caption: String(content.caption ?? ""),
          aspect: (String(content.aspectRatio ?? "16/9") === "4/3" ? "4/3" : "16/9") as "16/9" | "4/3",
          htmlClass: css,
        } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "icon") {
    const name = String(content.name ?? "star");
    const size = String(content.size ?? 24);
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "icon_list",
        settings: { items: [`Ícone: ${name} (${size}px)`], htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "form") {
    const base = getDefaultFormSettings();
    const action = String(content.actionUrl ?? content.action ?? content.href ?? "").trim();
    const submitLabel = String(content.submitText ?? base.submitLabel);
    const rawFields = content.fields as { name?: string; type?: string; label?: string; required?: boolean }[] | undefined;
    const fields =
      Array.isArray(rawFields) && rawFields.length > 0
        ? rawFields.map((f, i) => {
            const id = String(f.name ?? `field_${i}`).replace(/[^a-zA-Z0-9_]/g, "") || `field_${i}`;
            const ty = String(f.type ?? "text");
            const type = ty === "email" || ty === "textarea" ? ty : "text";
            return {
              id,
              type: type as "text" | "email" | "textarea",
              label: String(f.label ?? id),
              required: f.required === true,
              placeholder: "",
            };
          })
        : base.fields;
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "form",
        settings: {
          ...base,
          heading: String(content.title ?? content.heading ?? base.heading),
          description: String(content.description ?? base.description),
          action,
          submitLabel,
          fields,
          method: (String(content.method ?? "post").toLowerCase() === "get" ? "get" : "post") as "get" | "post",
          htmlClass: css,
        } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "testimonials") {
    const items = (content.items as { name?: string; quote?: string; title?: string }[]) ?? [];
    const first = items[0];
    if (first) {
      return finishImportWidget(
        normalizeWidgetNode({
          id,
          type: "testimonial",
          settings: {
            quote: String(first.quote ?? ""),
            author: String(first.name ?? ""),
            role: String(first.title ?? ""),
            avatarUrl: "",
            align: "center",
            htmlClass: css,
          } as WidgetNode["settings"],
        }),
      );
    }
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "html",
        settings: { html: testimonialsToHtml(content), htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "faq") {
    const raw = (content.items as { question?: string; answer?: string }[]) ?? [];
    const items = raw
      .map((q) => ({
        title: String(q.question ?? ""),
        body: String(q.answer ?? ""),
      }))
      .filter((x) => x.title.length > 0);
    if (items.length > 0) {
      return finishImportWidget(
        normalizeWidgetNode({
          id,
          type: "accordion",
          settings: { items, allowMultiple: false, htmlClass: css } as WidgetNode["settings"],
        }),
      );
    }
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "html",
        settings: { html: faqToHtml(content), htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "countdown") {
    const deadline = String(content.deadline ?? content.endDate ?? "");
    const d = deadline ? new Date(deadline) : new Date(Date.now() + 864e5);
    const targetDate = Number.isNaN(d.getTime()) ? new Date(Date.now() + 864e5).toISOString() : d.toISOString();
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "countdown",
        settings: {
          headline: String(content.title ?? ""),
          targetDate,
          labels: { days: "Dias", hours: "Horas", minutes: "Minutos", seconds: "Segundos" },
          expiredMessage: String(content.expiredMessage ?? "O tempo acabou."),
          htmlClass: css,
        } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "gallery") {
    const raw = (content.images as { src?: string; alt?: string }[]) ?? [];
    const images = raw
      .map((im) => ({ src: String(im?.src ?? "").trim(), alt: String(im?.alt ?? "") }))
      .filter((im) => im.src);
    if (images.length > 0) {
      return finishImportWidget(
        normalizeWidgetNode({
          id,
          type: "gallery",
          settings: {
            images,
            gridCols: 3,
            gap: "md",
            rounded: true,
            htmlClass: css,
          } as WidgetNode["settings"],
        }),
      );
    }
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "html",
        settings: { html: galleryToHtml(content), htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "animatedHeadline") {
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "html",
        settings: { html: animatedHeadlineToHtml(content), htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "priceTable") {
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "html",
        settings: { html: priceTableToHtml(content), htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "ctaBox") {
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "html",
        settings: { html: ctaBoxToHtml(content), htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "flipBox") {
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "html",
        settings: { html: flipBoxToHtml(content), htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }
  if (dpaType === "progressTracker") {
    return finishImportWidget(
      normalizeWidgetNode({
        id,
        type: "html",
        settings: { html: progressToHtml(content), htmlClass: css } as WidgetNode["settings"],
      }),
    );
  }

  const settings: Record<string, unknown> = { ...content };
  if (css) settings.htmlClass = css;
  if (o.styles) settings.styles = o.styles;
  if (dpaType === "html" && typeof content.html === "string" && content.code == null) {
    settings.html = content.html;
  }
  return finishImportWidget(
    normalizeWidgetNode({ id, type: landingType, settings: settings as WidgetNode["settings"] }),
  );
}

function convertDpaSection(sec: unknown): SectionNode {
  const s = dpaToPlainObject(sec);
  const columns = (s.columns as unknown[]) ?? [];
  const children: WidgetNode[] = [];
  for (const col of columns) {
    const c = dpaToPlainObject(col);
    const widgets = (c.widgets as unknown[]) ?? [];
    for (const w of widgets) {
      children.push(convertDpaWidget(w));
    }
  }
  return {
    id: typeof s.id === "string" && s.id ? s.id : newId(),
    type: "section",
    settings: {
      background: "default",
      paddingY: "md",
      fullBleed: s.layout === "full",
    },
    children,
  };
}

function convertBuildDpaPageToLanding(page: unknown): LandingDocument {
  const p = dpaToPlainObject(page);
  const rawSections = (p.sections as unknown[]) ?? [];
  const sections: SectionNode[] = rawSections.map((s) => convertDpaSection(s));
  if (sections.length === 0) {
    return getDefaultLandingDocument();
  }
  return normalizeLandingDocument({
    version: 1,
    sections,
  });
}

/**
 * Aceita: (1) `LandingDocument` com `version: 1`, (2) envelope `{ document: { ... } }`,
 * (3) exporto `PageDocument` build_dpa (secções com `columns` e widgets com `content`/`styles`).
 */
export function importLandingFromJson(raw: string): { ok: true; doc: LandingDocument } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "JSON inválido. Verifique vírgulas e aspas." };
  }
  if (parsed && typeof parsed === "object" && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    if (o.document && typeof o.document === "object" && o.sections === undefined) {
      parsed = o.document;
    }
  }
  if (isBuildDpaPageDocument(parsed)) {
    try {
      return { ok: true, doc: convertBuildDpaPageToLanding(parsed) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro na conversão build_dpa." };
    }
  }
  const doc = parseLandingDocument(parsed);
  return { ok: true, doc };
}
