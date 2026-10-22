/**
 * Injeta HTML arbitrário (ex.: <script src="…" data-…>) num contentor.
 * Scripts criados via DOM executam; innerHTML sozinho não executa scripts.
 * Apenas contas que editam a própria presell devem usar isto (confiança do dono).
 */

function materializeExecutableScript(old: HTMLScriptElement): HTMLScriptElement {
  const s = document.createElement("script");
  Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
  s.textContent = old.textContent;
  return s;
}

/**
 * Se o utilizador colar JS nu (sem &lt;script&gt;), envolve para o browser executar.
 * HTML com tags (script, noscript, img, …) passa intacto.
 */
export function coerceTrackingSnippetToHtml(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/<[a-z!/]/i.test(t)) return t;
  return `<script>\n${t}\n</script>`;
}

export function appendHtmlFragment(html: string, parent: HTMLElement): Element[] {
  const added: Element[] = [];
  const trimmed = coerceTrackingSnippetToHtml(html);
  if (!trimmed) return added;

  const tpl = document.createElement("template");
  tpl.innerHTML = trimmed;

  Array.from(tpl.content.childNodes).forEach((node) => {
    if (node.nodeType === Node.COMMENT_NODE) return;
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.textContent?.trim()) return;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    if (el.tagName === "SCRIPT") {
      const s = materializeExecutableScript(el as HTMLScriptElement);
      parent.appendChild(s);
      added.push(s);
      return;
    }

    const c = el.cloneNode(true) as Element;
    Array.from(c.querySelectorAll("script")).forEach((old) => {
      old.replaceWith(materializeExecutableScript(old as HTMLScriptElement));
    });
    parent.appendChild(c);
    added.push(c);
  });
  return added;
}

export function injectWithCleanup(html: string, parent: HTMLElement): () => void {
  const els = appendHtmlFragment(html, parent);
  return () => els.forEach((e) => e.remove());
}
