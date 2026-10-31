import { Suspense, useEffect } from "react";
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
import { WidgetMotionShell } from "./WidgetMotionShell";
import { SectionBackgroundLayers, sectionNeedsRelativeChrome } from "../section-chrome";
import { PageGlobalDesignVars } from "../page-global-design";
import { PagePopupOverlays } from "../page-popups";
import { WidgetConditionGate } from "./WidgetConditionGate";
import { ensurePageDocumentFonts } from "../typography-presets";
import { useViewportBuilderDevice } from "../useViewportBuilderDevice";

/**
 * Read-only renderer for a PageDocument.
 * Used by the live editor preview AND by the public /p/$slug route.
 * Widgets da 1.ª dobra são síncronos; o resto é lazy (LCP).
 * Sem `device`, segue a largura real do viewport (mobile/tablet/desktop).
 */
export function PageRenderer({
  doc,
  device: deviceProp,
}: {
  doc: PageDocument;
  device?: DeviceType;
}) {
  const viewportDevice = useViewportBuilderDevice();
  const device = deviceProp ?? viewportDevice;

  useEffect(() => {
    ensurePageDocumentFonts(doc);
  }, [doc]);

  return (
    <LcpMediaScope>
      <PageGlobalDesignVars settings={doc.settings}>
        <div
          data-pb-device={device}
          style={{
            background: doc.settings.background ?? "#ffffff",
            minHeight: "100%",
          }}
        >
          {doc.sections.map((section) => (
            <SectionRender key={section.id} section={section} device={device} />
          ))}
        </div>
        <PagePopupOverlays doc={doc} enabled />
      </PageGlobalDesignVars>
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
  const needsChrome = sectionNeedsRelativeChrome(section, hasBgVideo);

  const isStickyOrFixed =
    resolveResponsive(section.styles.position, device) === "sticky" ||
    resolveResponsive(section.styles.position, device) === "fixed";

  return (
    <section
      data-pb-id={section.id}
      data-stack={section.columns.length > 1 ? "1" : "0"}
      data-header={isStickyOrFixed ? "1" : undefined}
      style={{
        ...sectionStyle,
        maxWidth: "100%",
        boxSizing: "border-box",
        ...(needsChrome && !isStickyOrFixed
          ? {
              position:
                sectionStyle.position && sectionStyle.position !== "static"
                  ? sectionStyle.position
                  : "relative",
              overflow: "hidden" as const,
            }
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
      <SectionBackgroundLayers section={section} />
      <div
        data-pb-columns=""
        data-pb-stackable={section.columns.length > 1 ? "1" : "0"}
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: section.layout === "boxed" ? `${section.contentWidth}px` : "100%",
          width: "100%",
          marginLeft: "auto",
          marginRight: "auto",
          boxSizing: "border-box",
          paddingLeft: device === "mobile" ? 0 : undefined,
          paddingRight: device === "mobile" ? 0 : undefined,
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
      data-pb-id={column.id}
      data-pb-col=""
      style={{
        ...columnFlexItem(widthPercent, stacked),
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: resolveResponsive(column.styles.justifyContent, device) ?? "flex-start",
        minHeight: stacked ? undefined : "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        ...colStyle,
      }}
    >
      {column.widgets.map((widget) => {
        const Render = resolvePublicWidgetRender(widget.type);
        if (!Render) return null;
        const shell = stylesToCssWidgetShell(widget.styles, device);
        const wid = widget.cssId?.trim();
        const wcls = widget.cssClasses?.trim();
        return (
          <WidgetConditionGate key={widget.id} widget={widget} device={device}>
            <WidgetMotionShell
              widget={widget}
              id={wid || undefined}
              className={wcls || undefined}
              style={shell}
            >
              <Suspense fallback={null}>
                <Render widget={widget} device={device} />
              </Suspense>
            </WidgetMotionShell>
          </WidgetConditionGate>
        );
      })}
    </div>
  );
}
