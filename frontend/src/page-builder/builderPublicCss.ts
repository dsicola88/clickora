import type { CSSProperties } from "react";
import type {
  ColumnNode,
  DeviceType,
  PageDocument,
  SectionNode,
  WidgetNode,
} from "./types";
import { BUILDER_MOBILE_MAX_PX, BUILDER_TABLET_MAX_PX } from "./responsiveDefaults";
import {
  stylesToCss,
  stylesToCssWidgetContent,
  stylesToCssWidgetShell,
} from "./style-utils";

/** CSS base: empilhar colunas + media fluid — público SPA e HTML export. */
export const BUILDER_PUBLIC_RESPONSIVE_CSS = `
[data-clickora-builder-public] img,
[data-clickora-builder-public] video,
[data-clickora-builder-public] iframe {
  max-width: 100%;
  height: auto;
}
[data-clickora-builder-public] {
  overflow-x: clip;
}
[data-pb-col] {
  min-width: 0;
}
/* Alinhado a sectionDirectionFor: tablet + mobile empilham multi-coluna. */
@media (max-width: ${BUILDER_TABLET_MAX_PX}px) {
  [data-pb-columns][data-pb-stackable="1"] {
    flex-direction: column !important;
    flex-wrap: nowrap !important;
  }
  [data-pb-columns][data-pb-stackable="1"] > [data-pb-col] {
    flex: 0 0 auto !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  [data-pb-widget="infoBox"] [data-pb-content="1"] {
    flex-direction: column !important;
  }
  [data-pb-widget="gallery"] [data-pb-gallery-grid] {
    grid-template-columns: 1fr !important;
  }
}
@media (max-width: ${BUILDER_MOBILE_MAX_PX}px) {
  [data-pb-widget="gallery"] [data-pb-gallery-grid] {
    grid-template-columns: 1fr !important;
  }
}
`.trim();

function cssPropsToDeclarations(css: CSSProperties): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(css)) {
    if (value === undefined || value === null || value === "") continue;
    const prop = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    lines.push(`${prop}:${String(value)} !important`);
  }
  return lines.join(";");
}

function emitNodeOverride(
  selector: string,
  desktop: CSSProperties,
  other: CSSProperties,
): string | null {
  const changed: CSSProperties = {};
  for (const key of Object.keys(other) as (keyof CSSProperties)[]) {
    if (String(other[key] ?? "") !== String(desktop[key] ?? "")) {
      (changed as Record<string, unknown>)[key as string] = other[key];
    }
  }
  const decl = cssPropsToDeclarations(changed);
  if (!decl) return null;
  return `${selector}{${decl}}`;
}

function walkWidgets(
  widgets: WidgetNode[],
  device: DeviceType,
  desktopCss: Map<string, { shell: CSSProperties; content: CSSProperties }>,
  out: string[],
) {
  for (const widget of widgets) {
    const shell = stylesToCssWidgetShell(widget.styles, device);
    const content = stylesToCssWidgetContent(widget.styles, device);
    const desk = desktopCss.get(widget.id) ?? {
      shell: stylesToCssWidgetShell(widget.styles, "desktop"),
      content: stylesToCssWidgetContent(widget.styles, "desktop"),
    };
    desktopCss.set(widget.id, desk);
    const idSel = `[data-pb-id="${cssEscape(widget.id)}"]`;
    /** Shell no invólucro; tipografia/padding só no nó marcado `data-pb-content` (evita 3× margin). */
    const a = emitNodeOverride(idSel, desk.shell, shell);
    const b = emitNodeOverride(`${idSel} [data-pb-content="1"]`, desk.content, content);
    if (a) out.push(a);
    if (b) out.push(b);
    const kids = widget.content?.widgets;
    if (Array.isArray(kids)) walkWidgets(kids as WidgetNode[], device, desktopCss, out);
  }
}

function walkSection(
  section: SectionNode,
  device: DeviceType,
  desktopCss: Map<string, CSSProperties>,
  widgetDesk: Map<string, { shell: CSSProperties; content: CSSProperties }>,
  out: string[],
) {
  const css = stylesToCss(section.styles, device);
  const desk = desktopCss.get(section.id) ?? stylesToCss(section.styles, "desktop");
  desktopCss.set(section.id, desk);
  const rule = emitNodeOverride(`[data-pb-id="${cssEscape(section.id)}"]`, desk, css);
  if (rule) out.push(rule);

  for (const col of section.columns) {
    walkColumn(col, device, desktopCss, widgetDesk, out);
  }
}

function walkColumn(
  column: ColumnNode,
  device: DeviceType,
  desktopCss: Map<string, CSSProperties>,
  widgetDesk: Map<string, { shell: CSSProperties; content: CSSProperties }>,
  out: string[],
) {
  const css = stylesToCss(column.styles, device);
  const desk = desktopCss.get(column.id) ?? stylesToCss(column.styles, "desktop");
  desktopCss.set(column.id, desk);
  const rule = emitNodeOverride(`[data-pb-id="${cssEscape(column.id)}"]`, desk, css);
  if (rule) out.push(rule);
  walkWidgets(column.widgets, device, widgetDesk, out);
}

function cssEscape(id: string): string {
  return id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Media queries com overrides (explícitos + escala implícita via stylesToCss)
 * para HTML estático (export), onde o React não muda o `device`.
 */
export function buildDocumentResponsiveCss(doc: PageDocument): string {
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];
  const sectionDesk = new Map<string, CSSProperties>();
  const widgetDesk = new Map<string, { shell: CSSProperties; content: CSSProperties }>();

  for (const section of doc.sections) {
    walkSection(section, "tablet", sectionDesk, widgetDesk, tabletRules);
    walkSection(section, "mobile", sectionDesk, widgetDesk, mobileRules);
  }

  const parts: string[] = [BUILDER_PUBLIC_RESPONSIVE_CSS];
  if (tabletRules.length) {
    parts.push(
      `@media (max-width: ${BUILDER_TABLET_MAX_PX}px) and (min-width: ${BUILDER_MOBILE_MAX_PX + 1}px) {\n${tabletRules.join("\n")}\n}`,
    );
  }
  if (mobileRules.length) {
    parts.push(`@media (max-width: ${BUILDER_MOBILE_MAX_PX}px) {\n${mobileRules.join("\n")}\n}`);
  }
  return parts.join("\n");
}
