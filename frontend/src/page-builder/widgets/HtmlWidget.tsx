import { useLayoutEffect, useRef } from "react";
import type { DeviceType, WidgetNode } from "../types";
import { useInlineEdit } from "../inline-edit";
import { stylesToCssWidgetContent } from "../style-utils";
import {
  applyHtmlFoldPatchToElement,
  clearHtmlFoldSelectionMarks,
  enableTextFieldsInRoot,
  ensureHtmlFoldEditorStyle,
  markHtmlFoldSelected,
  serializeHtmlFoldContent,
  snapshotHtmlFoldElement,
  useHtmlFoldEdit,
  type HtmlFoldPatch,
} from "../htmlFoldEdit";

function rewriteShadowAssets(shadow: ShadowRoot) {
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
  shadow.querySelectorAll("img[src], source[src]").forEach((el) => {
    const src = el.getAttribute("src");
    if (!src || /^(https?:|data:|blob:)/i.test(src)) return;
    try {
      el.setAttribute("src", new URL(src, baseHref).href);
    } catch {
      /* ignore */
    }
  });
}

function mountEditableWrap(shadow: ShadowRoot, html: string): HTMLElement {
  while (shadow.firstChild) shadow.removeChild(shadow.firstChild);
  ensureHtmlFoldEditorStyle(shadow);
  const wrap = document.createElement("div");
  wrap.setAttribute("data-clickora-html-edit", "1");
  wrap.style.outline = "none";
  wrap.style.minHeight = "24px";
  wrap.contentEditable = "false";
  wrap.innerHTML = html;
  shadow.appendChild(wrap);
  rewriteShadowAssets(shadow);
  enableTextFieldsInRoot(wrap);
  return wrap;
}

function ensureEditableWrap(shadow: ShadowRoot): HTMLElement {
  ensureHtmlFoldEditorStyle(shadow);
  let wrap = shadow.querySelector("[data-clickora-html-edit]") as HTMLElement | null;
  if (wrap) {
    enableTextFieldsInRoot(wrap);
    wrap.contentEditable = "false";
    return wrap;
  }
  wrap = document.createElement("div");
  wrap.setAttribute("data-clickora-html-edit", "1");
  wrap.style.outline = "none";
  wrap.style.minHeight = "24px";
  wrap.contentEditable = "false";
  const move: ChildNode[] = [];
  shadow.childNodes.forEach((n) => {
    if (n instanceof HTMLElement && n.getAttribute("data-clickora-html-editor") === "1") return;
    move.push(n);
  });
  move.forEach((n) => wrap!.appendChild(n));
  shadow.appendChild(wrap);
  enableTextFieldsInRoot(wrap);
  return wrap;
}

function pickEditableTarget(raw: Element, wrap: HTMLElement): Element | null {
  if (raw === wrap) return null;
  const img = raw.closest("img,picture");
  if (img && wrap.contains(img)) return img;
  const link = raw.closest("a,button,[role='button']");
  if (link && wrap.contains(link)) return link;
  const heading = raw.closest("h1,h2,h3,h4,h5,h6,p,li");
  if (heading && wrap.contains(heading)) return heading;
  let el: Element | null = raw;
  while (el && el !== wrap) {
    if (el.parentElement === wrap) return el;
    el = el.parentElement;
  }
  return raw !== wrap ? raw : null;
}

/** O HTML importado fica no shadow DOM — CSS da origem intacto, edição por elemento. */
export function HtmlWidget({ widget, device }: { widget: WidgetNode; device: DeviceType }) {
  const code = (widget.content.code as string) ?? "";
  const hostRef = useRef<HTMLDivElement>(null);
  const appliedCode = useRef<string | null>(null);
  const selectedElRef = useRef<Element | null>(null);
  const selfPersistRef = useRef(false);
  const commit = useInlineEdit();
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const hostStyle = stylesToCssWidgetContent(widget.styles, device);
  const setSelection = useHtmlFoldEdit((s) => s.setSelection);
  const setApplyPatch = useHtmlFoldEdit((s) => s.setApplyPatch);
  const clearFold = useHtmlFoldEdit((s) => s.clear);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const getWrap = () =>
      shadow.querySelector("[data-clickora-html-edit]") as HTMLElement | null;

    const fromSelfPersist = selfPersistRef.current;
    if (fromSelfPersist) {
      selfPersistRef.current = false;
      appliedCode.current = code;
    } else if (appliedCode.current !== code) {
      if (commit) mountEditableWrap(shadow, code);
      else {
        while (shadow.firstChild) shadow.removeChild(shadow.firstChild);
        shadow.innerHTML = code;
        rewriteShadowAssets(shadow);
      }
      appliedCode.current = code;
      selectedElRef.current = null;
      if (useHtmlFoldEdit.getState().selection?.widgetId === widget.id) {
        setSelection(null);
      }
    } else if (commit) {
      ensureEditableWrap(shadow);
    }

    if (!commit) {
      setApplyPatch(null);
      return;
    }

    // Re-regista sempre (o cleanup anterior removeu os listeners).
    const persist = () => {
      const wrap = getWrap();
      if (!wrap) return;
      const next = serializeHtmlFoldContent(wrap);
      if (next === appliedCode.current) return;
      appliedCode.current = next;
      selfPersistRef.current = true;
      commitRef.current?.({ code: next });
    };

    const selectElement = (el: Element | null) => {
      const wrap = getWrap();
      if (!wrap) return;
      clearHtmlFoldSelectionMarks(wrap);
      selectedElRef.current = el;
      if (!el) {
        setSelection(null);
        return;
      }
      markHtmlFoldSelected(el);
      setSelection(snapshotHtmlFoldElement(widget.id, el));
    };

    const onPatch = (patch: HtmlFoldPatch) => {
      const wrap = getWrap();
      const el = selectedElRef.current;
      if (!wrap || !el || !wrap.contains(el)) return;
      applyHtmlFoldPatchToElement(el, patch);
      markHtmlFoldSelected(el);
      setSelection(snapshotHtmlFoldElement(widget.id, el));
      persist();
    };

    const onClick = (event: Event) => {
      const wrap = getWrap();
      if (!wrap) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("a")) event.preventDefault();
      const picked = pickEditableTarget(target, wrap);
      if (!picked) return;
      event.stopPropagation();
      selectElement(picked);
    };

    const onFocusOut = (event: FocusEvent) => {
      const wrap = getWrap();
      const related = event.relatedTarget;
      if (wrap && related instanceof Node && wrap.contains(related)) return;
      persist();
    };

    const stopDrag = (event: Event) => event.stopPropagation();

    // Restaurar outline se a selecção sobreviveu ao self-persist.
    if (fromSelfPersist && selectedElRef.current && getWrap()?.contains(selectedElRef.current)) {
      markHtmlFoldSelected(selectedElRef.current);
      setSelection(snapshotHtmlFoldElement(widget.id, selectedElRef.current));
    }

    setApplyPatch(onPatch);
    shadow.addEventListener("click", onClick, true);
    shadow.addEventListener("focusout", onFocusOut);
    host.addEventListener("mousedown", stopDrag);

    return () => {
      shadow.removeEventListener("click", onClick, true);
      shadow.removeEventListener("focusout", onFocusOut);
      host.removeEventListener("mousedown", stopDrag);
      if (selfPersistRef.current) return;
      if (useHtmlFoldEdit.getState().selection?.widgetId === widget.id) clearFold();
      else setApplyPatch(null);
    };
  }, [code, commit, widget.id, setSelection, setApplyPatch, clearFold]);

  return (
    <div
      ref={hostRef}
      style={{ ...hostStyle, width: "100%" }}
      data-presell-html-fold="1"
      data-presell-html-editable={commit ? "1" : undefined}
      data-presell-html-fidelity="1"
    />
  );
}
