import { useLayoutEffect, useRef } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { useInlineEdit } from "../inline-edit";

function rewriteShadowStylesheets(shadow: ShadowRoot) {
  const baseHref = shadow.querySelector("base")?.getAttribute("href")?.trim() || "";
  if (!baseHref) return;
  shadow.querySelectorAll("link[href]").forEach((el) => {
    const href = el.getAttribute("href");
    if (!href || /^(https?:|data:)/i.test(href)) return;
    try {
      el.setAttribute("href", new URL(href, baseHref).href);
    } catch {
      /* ignore */
    }
  });
}

function editorWrap(shadow: ShadowRoot): HTMLElement {
  let wrap = shadow.querySelector("[data-clickora-html-edit]") as HTMLElement | null;
  if (wrap) return wrap;
  wrap = document.createElement("div");
  wrap.setAttribute("data-clickora-html-edit", "1");
  wrap.style.outline = "none";
  wrap.style.minHeight = "24px";
  while (shadow.firstChild) wrap.appendChild(shadow.firstChild);
  shadow.appendChild(wrap);
  return wrap;
}

/** O HTML importado fica no shadow DOM para o CSS da origem não partir o resto da página. */
export function HtmlWidget({ widget }: { widget: WidgetNode; device: DeviceType }) {
  const code = (widget.content.code as string) ?? "";
  const hostRef = useRef<HTMLDivElement>(null);
  const appliedCode = useRef<string | null>(null);
  const commit = useInlineEdit();
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });

    if (appliedCode.current !== code) {
      if (commit) {
        const wrap = editorWrap(shadow);
        wrap.innerHTML = code;
      } else {
        shadow.querySelector("[data-clickora-html-edit]")?.remove();
        shadow.innerHTML = code;
      }
      rewriteShadowStylesheets(shadow);
      appliedCode.current = code;
    } else if (commit) {
      editorWrap(shadow);
    }

    const wrap = shadow.querySelector("[data-clickora-html-edit]") as HTMLElement | null;
    if (commit && wrap) wrap.contentEditable = "true";
    else if (wrap) wrap.contentEditable = "false";

    const persist = () => {
      const next = wrap ? wrap.innerHTML : shadow.innerHTML;
      if (next === appliedCode.current) return;
      appliedCode.current = next;
      commitRef.current?.({ code: next });
    };

    const blockNav = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a")) event.preventDefault();
    };

    const stopDrag = (event: Event) => event.stopPropagation();

    if (commit) {
      shadow.addEventListener("focusout", persist);
      shadow.addEventListener("click", blockNav);
      host.addEventListener("mousedown", stopDrag);
    }

    return () => {
      shadow.removeEventListener("focusout", persist);
      shadow.removeEventListener("click", blockNav);
      host.removeEventListener("mousedown", stopDrag);
    };
  }, [code, commit]);

  return (
    <div
      ref={hostRef}
      data-presell-html-fold="1"
      data-presell-html-editable={commit ? "1" : undefined}
    />
  );
}
