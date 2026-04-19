import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span"]);

export function HeadingWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const text = (widget.content.text as string) ?? "";
  const rawTag = ((widget.content.tag as string) ?? "h2").toLowerCase();
  const tag = HEADING_TAGS.has(rawTag) ? rawTag : "h2";
  const Tag = tag as "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div" | "span";

  const link = ((widget.content.link as string) ?? "").trim();
  const linkTarget = ((widget.content.linkTarget as string) ?? "_self") as "_self" | "_blank";
  const linkNofollow = Boolean(widget.content.linkNofollow);

  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);

  const rel =
    linkTarget === "_blank"
      ? linkNofollow
        ? "noopener noreferrer nofollow"
        : "noopener noreferrer"
      : linkNofollow
        ? "nofollow"
        : undefined;

  const inner =
    link.length > 0 ? (
      <a
        href={link}
        target={linkTarget}
        rel={rel}
        style={{ color: "inherit", textDecoration: "inherit" }}
      >
        {text}
      </a>
    ) : (
      text
    );

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        width: "100%",
      }}
    >
      <Tag style={{ margin: 0, ...css }}>{inner}</Tag>
    </div>
  );
}
