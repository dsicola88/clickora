import { Suspense } from "react";
import type { ColumnNode, DeviceType, PageDocument, SectionNode } from "../types";
import { resolveResponsive } from "../store";
import {
  columnFlexItem,
  isSectionStacked,
  sectionColumnsGrid,
  sectionDirectionFor,
  stylesToCss,
  stylesToCssWidgetShell,
} from "../style-utils";
import { resolvePublicWidgetRender } from "../widget-public-render";
import { LcpMediaScope } from "../lcp-media";
import { SectionBackgroundVideo } from "./SectionBackgroundVideo";
import { WidgetInlineStyle } from "../widget-custom-css";
import { motionClassName, widgetHasMotion } from "../widget-motion";

/**
 * Read-only renderer for a PageDocument.
 * Used by the live editor preview AND by the public /p/$slug route.
 * Widgets da 1.ª dobra são síncronos; o resto é lazy (LCP).
 */
export function PageRenderer({
  doc,
  device = "desktop",
}: {
  doc: PageDocument;
  device?: DeviceType;
}) {
  return (
    <LcpMediaScope>
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
    </LcpMediaScope>
  );
}

function SectionRender({ section, device }: { section: SectionNode; device: DeviceType }) {
  const sectionStyle = stylesToCss(section.styles, device);
  const gap = resolveResponsive(section.columnGap, device) ?? 20;
  const widths = section.columns.map((c) => resolveResponsive(c.widthPercent, device) ?? 100);
  const direction = sectionDirectionFor(section.flex?.direction, device, section.columns.length);
  const stacked = isSectionStacked(direction);
  const bgVideo = (section.backgroundVideoUrl ?? "").trim();
  const hasBgVideo = bgVideo.length > 0;

  const isStickyOrFixed =
    resolveResponsive(section.styles.position, device) === "sticky" ||
    resolveResponsive(section.styles.position, device) === "fixed";

  return (
    <section
      data-stack={section.columns.length > 1 ? "1" : "0"}
      data-header={isStickyOrFixed ? "1" : undefined}
      style={{
        ...sectionStyle,
        ...(hasBgVideo && !isStickyOrFixed
          ? { position: "relative", overflow: "hidden" as const }
          : {}),
        ...(isStickyOrFixed
          ? {
              position: sectionStyle.position ?? "sticky",
              top: sectionStyle.top ?? "0",
              zIndex: sectionStyle.zIndex ?? 200,
              width: "100%",
              background: sectionStyle.background ?? "#ffffff",
            }
          : {}),
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
          ...sectionColumnsGrid(widths, device, gap, {
            direction,
            justify: resolveResponsive(section.flex?.justify, device),
            align: resolveResponsive(section.flex?.align, device),
            wrap: resolveResponsive(section.flex?.wrap, device),
          }),
        }}
      >
        {section.columns.map((col, index) => (
          <ColumnRender
            key={col.id}
            column={col}
            device={device}
            stacked={stacked}
            widthPercent={widths[index] ?? 100}
          />
        ))}
      </div>
    </section>
  );
}

function ColumnRender({
  column,
  device,
  stacked,
  widthPercent,
}: {
  column: ColumnNode;
  device: DeviceType;
  stacked: boolean;
  widthPercent: number;
}) {
  const colStyle = stylesToCss(column.styles, device);
  return (
    <div
      style={{
        ...columnFlexItem(widthPercent, stacked),
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        ...colStyle,
      }}
    >
      {column.widgets.map((widget) => {
        const Render = resolvePublicWidgetRender(widget.type);
        if (!Render) return null;
        const shell = stylesToCssWidgetShell(widget.styles, device);
        const wid = widget.cssId?.trim();
        const wcls = widget.cssClasses?.trim();
        const motionCls = widgetHasMotion(widget.effects, widget.content)
          ? motionClassName(widget.id)
          : "";
        const className = [wcls, motionCls].filter(Boolean).join(" ") || undefined;
        return (
          <div key={widget.id} id={wid || undefined} className={className} style={shell}>
            <WidgetInlineStyle widget={widget} />
            <Suspense fallback={null}>
              <Render widget={widget} device={device} />
            </Suspense>
          </div>
        );
      })}
    </div>
  );
}
