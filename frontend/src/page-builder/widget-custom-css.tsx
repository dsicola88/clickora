import type { WidgetNode } from "./types";
import { buildWidgetMotionCss, widgetHasMotion } from "./widget-motion";

/** Evita fecho acidental de `<style>` no markup. */
export function sanitizeWidgetCustomCss(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

/** Estilo por widget — usa `dangerouslySetInnerHTML` só com CSS do próprio criador da página. */
export function WidgetInlineStyle({ widget }: { widget: WidgetNode }) {
  const custom = widget.customCss?.trim() ?? "";
  const motion = widgetHasMotion(widget.effects, widget.content)
    ? buildWidgetMotionCss(widget.id, widget.effects, widget.content)
    : "";
  const raw = [motion, custom].filter(Boolean).join("\n");
  if (!raw) return null;
  return (
    <style
      type="text/css"
      data-clickora-widget-css={widget.id}
      dangerouslySetInnerHTML={{ __html: sanitizeWidgetCustomCss(raw) }}
    />
  );
}
