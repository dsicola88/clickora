/**
 * Injeta HTML arbitrário (ex.: <script src="…" data-…>) num contentor.
 * Scripts criados via DOM executam; innerHTML sozinho não executa scripts.
 * Apenas contas que editam a própria presell devem usar isto (confiança do dono).
 */
export function appendHtmlFragment(html: string, parent: HTMLElement): Element[] {
  const added: Element[] = [];
  const trimmed = html.trim();
  if (!trimmed) return added;

  const tpl = document.createElement("template");
  tpl.innerHTML = trimmed;
  Array.from(tpl.content.children).forEach((el) => {
    if (el.tagName === "SCRIPT") {
      const old = el as HTMLScriptElement;
      const s = document.createElement("script");
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      parent.appendChild(s);
      added.push(s);
    } else {
      const c = el.cloneNode(true) as Element;
      parent.appendChild(c);
      added.push(c);
    }
  });
  return added;
}

export function injectWithCleanup(html: string, parent: HTMLElement): () => void {
  const els = appendHtmlFragment(html, parent);
  return () => els.forEach((e) => e.remove());
}
