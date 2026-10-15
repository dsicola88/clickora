import { useLayoutEffect, useRef } from "react";
import type { DeviceType, WidgetNode } from "../types";

/** O HTML importado fica no shadow DOM para o CSS da origem não partir o resto da página. */
export function HtmlWidget({ widget }: { widget: WidgetNode; device: DeviceType }) {
  const code = (widget.content.code as string) ?? "";
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.innerHTML = code;
  }, [code]);

  return <div ref={hostRef} data-presell-html-fold="1" />;
}
