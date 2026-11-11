import { useEffect, useState } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent } from "../style-utils";
import { usePageBuilderT } from "../usePageBuilderT";

type TocItem = { id: string; text: string; level: number };

/**
 * Índice automático a partir de headings h2–h4 com id na página.
 * Também aceita lista manual em content.items.
 */
export function TableOfContentsWidget({
  widget,
  device,
}: {
  widget: WidgetNode;
  device: DeviceType;
}) {
  const t = usePageBuilderT();
  const c = widget.content;
  const tocTitle = t("pages.pageBuilder.defaults.tocTitle");
  const title = ((c.title as string) ?? tocTitle).trim();
  const manual = Array.isArray(c.items)
    ? (c.items as Array<{ id?: string; label?: string; href?: string }>)
    : [];
  const auto = c.auto !== false;
  const color = ((c.linkColor as string) ?? "#0f172a").trim();
  const hover = ((c.hoverColor as string) ?? "#e63946").trim();
  const css = stylesToCssWidgetContent(widget.styles, device);
  const [autoItems, setAutoItems] = useState<TocItem[]>([]);

  useEffect(() => {
    if (!auto) return;
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("h2[id],h3[id],h4[id]"),
    );
    setAutoItems(
      nodes.map((el) => ({
        id: el.id,
        text: (el.textContent || el.id).trim(),
        level: Number(el.tagName.replace("H", "")) || 2,
      })),
    );
  }, [auto]);

  const items =
    manual.length > 0
      ? manual.map((m) => ({
          href: m.href || (m.id ? `#${m.id}` : "#"),
          label: m.label || m.id || t("pages.pageBuilder.defaults.tocSection"),
          level: 2,
        }))
      : autoItems.map((a) => ({
          href: `#${a.id}`,
          label: a.text,
          level: a.level,
        }));

  return (
    <nav style={{ ...css }} aria-label={title || tocTitle}>
      {title ? (
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 16 }}>{title}</div>
      ) : null}
      <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.length === 0 ? (
          <li style={{ fontSize: 13, opacity: 0.6 }}>
            {t("pages.pageBuilder.defaults.tocEmpty")}
          </li>
        ) : (
          items.map((it, i) => (
            <li
              key={`${it.href}-${i}`}
              style={{
                marginBottom: 8,
                paddingLeft: Math.max(0, (it.level - 2) * 14),
              }}
            >
              <a
                href={it.href}
                style={{ color, textDecoration: "none", fontSize: 14 }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = hover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = color;
                }}
              >
                {it.label}
              </a>
            </li>
          ))
        )}
      </ol>
    </nav>
  );
}
