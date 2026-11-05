import { useEffect } from "react";
import { useAppLocale } from "./AppLocaleProvider";
import { translateLegacyPt } from "./legacyBridge";

const SKIP_SEL = "script,style,textarea,input,select,option,code,pre,[contenteditable='true'],[data-no-i18n]";

function translateAttrs(el: Element, locale: Parameters<typeof translateLegacyPt>[0]) {
  for (const attr of ["title", "placeholder", "aria-label", "aria-description", "alt"] as const) {
    const v = el.getAttribute(attr);
    if (!v) continue;
    const next = translateLegacyPt(locale, v);
    if (next !== v) el.setAttribute(attr, next);
  }
}

function translateTextNode(node: Text, locale: Parameters<typeof translateLegacyPt>[0]) {
  const raw = node.nodeValue;
  if (!raw) return;
  const trimmed = raw.trim();
  if (trimmed.length < 2) return;
  const next = translateLegacyPt(locale, trimmed);
  if (next === trimmed) return;
  // Preserve leading/trailing whitespace
  const lead = raw.match(/^\s*/)?.[0] ?? "";
  const trail = raw.match(/\s*$/)?.[0] ?? "";
  node.nodeValue = `${lead}${next}${trail}`;
}

/**
 * Best-effort DOM pass for leftover Portuguese chrome after React paint.
 * Skips form fields and code. Safe no-op when locale is PT.
 */
export function LegacyDomLocalizer() {
  const { locale } = useAppLocale();

  useEffect(() => {
    if (locale === "pt") return;
    const root = document.getElementById("root") ?? document.body;
    let scheduled = 0;

    const run = () => {
      scheduled = 0;
      const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const parent = node.parentElement;
          if (parent?.closest(SKIP_SEL)) return;
          translateTextNode(node as Text, locale);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as Element;
        if (el.matches(SKIP_SEL) || el.closest(SKIP_SEL)) return;
        translateAttrs(el, locale);
        const children = el.childNodes;
        for (let i = 0; i < children.length; i++) walk(children[i]!);
      };
      walk(root);
    };

    const kick = () => {
      if (scheduled) return;
      scheduled = window.setTimeout(run, 40);
    };

    run();
    const mo = new MutationObserver(kick);
    mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "placeholder", "aria-label", "alt"] });
    return () => {
      mo.disconnect();
      if (scheduled) window.clearTimeout(scheduled);
    };
  }, [locale]);

  return null;
}
