import type { DeviceType, WidgetNode } from "../types";
import { stylesToCssWidgetContent, alignToFlexJustify } from "../style-utils";
import { resolveResponsive } from "../store";
import { useInlineEdit } from "../inline-edit";

export function TextWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const html = (widget.content.html as string) ?? "";
  const align = resolveResponsive(widget.styles.align, device);
  const css = stylesToCssWidgetContent(widget.styles, device);
  const commit = useInlineEdit();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignToFlexJustify(align),
        width: "100%",
      }}
    >
      {commit ? (
        <div
          style={css}
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: html }}
          onBlur={(e) => {
            const next = e.currentTarget.innerHTML;
            if (next !== html) commit({ html: next });
          }}
        />
      ) : (
        <div style={css} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}
