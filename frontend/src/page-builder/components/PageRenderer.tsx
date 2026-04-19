import type { ColumnNode, DeviceType, PageDocument, SectionNode } from "../types";
import { resolveResponsive } from "../store";
import { stylesToCss, stylesToCssWidgetShell } from "../style-utils";
import { WIDGET_REGISTRY } from "../widget-registry";
import { SectionBackgroundVideo } from "./SectionBackgroundVideo";
import { WidgetInlineStyle } from "../widget-custom-css";

/**
 * Read-only renderer for a PageDocument.
 * Used by the live editor preview AND by the public /p/$slug route.
 * Contains zero editor chrome — just clean output.
 */
export function PageRenderer({
  doc,
  device = "desktop",
}: {
  doc: PageDocument;
  device?: DeviceType;
}) {
  return (
    <div
      style={{
        background: doc.settings.background ?? "#ffffff",
        minHeight: "100%",
      }}
    >
      {doc.sections.map((section) => (
        <SectionRender key={section.id} section={section} device={device} />
      ))}
    </div>
  );
}

function SectionRender({ section, device }: { section: SectionNode; device: DeviceType }) {
  const sectionStyle = stylesToCss(section.styles, device);
  const gap = resolveResponsive(section.columnGap, device) ?? 20;
  const bgVideo = (section.backgroundVideoUrl ?? "").trim();
  const hasBgVideo = bgVideo.length > 0;

  return (
    <section
      style={{
        ...sectionStyle,
        ...(hasBgVideo ? { position: "relative", overflow: "hidden" as const } : {}),
      }}
    >
      {hasBgVideo ? <SectionBackgroundVideo rawUrl={bgVideo} pointerEventsNone /> : null}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: section.layout === "boxed" ? `${section.contentWidth}px` : "100%",
          marginLeft: "auto",
          marginRight: "auto",
          display: "flex",
          flexDirection: device === "mobile" ? "column" : "row",
          gap: `${gap}px`,
        }}
      >
        {section.columns.map((col) => (
          <ColumnRender key={col.id} column={col} device={device} />
        ))}
      </div>
    </section>
  );
}

function ColumnRender({ column, device }: { column: ColumnNode; device: DeviceType }) {
  const widthPct = resolveResponsive(column.widthPercent, device) ?? 100;
  const colStyle = stylesToCss(column.styles, device);
  return (
    <div
      style={{
        flexBasis: device === "mobile" ? "100%" : `${widthPct}%`,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        minWidth: 0,
        ...colStyle,
      }}
    >
      {column.widgets.map((widget) => {
        const def = WIDGET_REGISTRY[widget.type];
        if (!def) return null;
        const Render = def.Render;
        const shell = stylesToCssWidgetShell(widget.styles, device);
        const wid = widget.cssId?.trim();
        const wcls = widget.cssClasses?.trim();
        return (
          <div
            key={widget.id}
            id={wid || undefined}
            className={wcls || undefined}
            style={shell}
          >
            <WidgetInlineStyle widget={widget} />
            <Render widget={widget} device={device} />
          </div>
        );
      })}
    </div>
  );
}
