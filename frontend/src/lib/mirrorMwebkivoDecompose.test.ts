import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sectionsFromMirrorHtml, decomposeMirrorHtmlToWidgets } from "./mirrorHtmlToEditableWidgets";
import { buildEditablePageDocument, mirrorSrcDocToEditableHtml } from "./presellVisualEdit";

const FIXTURE = resolve(__dirname, "../../tmp-mweb.html");

describe("mwebkivo / visivra white mirror decompose", () => {
  it.skipIf(!existsSync(FIXTURE))("converte o HTML real em blocos editáveis", () => {
    const raw = readFileSync(FIXTURE, "utf8");
    expect(raw.length).toBeGreaterThan(1000);
    const editable = mirrorSrcDocToEditableHtml(raw);
    const widgets = decomposeMirrorHtmlToWidgets(editable);
    const types = widgets.map((w) => w.type);
    expect(types.filter((t) => t === "heading").length).toBeGreaterThanOrEqual(1);
    expect(types.some((t) => t === "button" || t === "image" || t === "text")).toBe(true);
    const secs = sectionsFromMirrorHtml(editable);
    const natives = secs
      .flatMap((s) => s.columns[0].widgets)
      .filter((w) => ["heading", "text", "image", "button"].includes(w.type));
    expect(natives.length).toBeGreaterThanOrEqual(2);

    const doc = buildEditablePageDocument({
      title: "Visivra",
      type: "cookies",
      content: {
        title: "Visivra",
        generationNiche: "white",
        affiliateLink: "https://mwebkivo.com/12679/3986/46/",
        importMirrorSrcDoc: raw,
      },
    });
    // Create path: HTML fiel (não partilhar layout Visivra em blocos).
    expect(doc.settings.htmlFoldMode).toBe("faithful");
    const all = doc.sections.flatMap((s) => s.columns.flatMap((c) => c.widgets));
    const html = all.find((w) => w.type === "html");
    expect(html).toBeTruthy();
    expect(String(html?.content.code).length).toBeGreaterThan(800);
    expect(html?.content.fromMirror).toBe(true);
  });
});
