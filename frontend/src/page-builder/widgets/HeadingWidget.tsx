import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";
import { useInlineEdit } from "../inline-edit";

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
  const commit = useInlineEdit();
  const shrink = resolveResponsive(widget.styles.flexShrink, device);
  const grow = resolveResponsive(widget.styles.flexGrow, device);

  const rel =
    linkTarget === "_blank"
      ? linkNofollow
        ? "noopener noreferrer nofollow"
        : "noopener noreferrer"
      : linkNofollow
        ? "nofollow"
        : undefined;

  const frame = {
    display: "flex" as const,
    justifyContent: alignToFlexJustify(align),
    width: css.width ?? "100%",
    maxWidth: "100%",
    minWidth: shrink === 0 ? "auto" : 0,
    flexShrink: shrink ?? 1,
    flexGrow: grow,
    whiteSpace: shrink === 0 ? ("nowrap" as const) : undefined,
  };

  if (commit) {
    return (
      <div style={frame} title={link.length > 0 ? `Link: ${link}` : undefined}>
        <Tag
          style={{
            margin: 0,
            ...css,
            ...(link.length > 0
              ? {
                  textDecoration: "underline",
                  textDecorationColor: "color-mix(in oklab, currentColor 35%, transparent)",
                  textUnderlineOffset: 3,
                }
              : {}),
          }}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const next = e.currentTarget.textContent ?? "";
            if (next !== text) commit({ text: next });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        >
          {text}
        </Tag>
      </div>
    );
  }

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
    <div style={frame}>
      <Tag style={{ margin: 0, ...css }}>{inner}</Tag>
    </div>
  );
}
