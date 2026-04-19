import type { WidgetNode } from "./types";

/** Evita fecho acidental de `<style>` no markup. */
export function sanitizeWidgetCustomCss(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

/** Estilo por widget — usa `dangerouslySetInnerHTML` só com CSS do próprio criador da página. */
export function WidgetInlineStyle({ widget }: { widget: WidgetNode }) {
  const raw = widget.customCss?.trim();
  if (!raw) return null;
  return (
    <style
      type="text/css"
      data-clickora-widget-css={widget.id}
      dangerouslySetInnerHTML={{ __html: sanitizeWidgetCustomCss(raw) }}
    />
  );
}
