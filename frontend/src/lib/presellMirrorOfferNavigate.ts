export const CLICKORA_OFFER_NAV_MESSAGE = "clickora:offer-navigate";

/** Navega a janela principal para o hoplink rastreado (iframe sandbox-safe). */
export function navigatePresellOfferFromMirrorEvent(e: Event, dest: string): void {
  const href = dest.trim();
  if (!href || href === "#") return;

  /** Listener é registado pelo React na página pai — `window` já é a janela principal. */
  try {
    window.location.assign(href);
    return;
  } catch {
    /* continue */
  }

  const doc =
    e.currentTarget instanceof Document
      ? e.currentTarget
      : e.target instanceof Node
        ? e.target.ownerDocument
        : null;
  const view = doc?.defaultView ?? null;

  try {
    if (view?.top) {
      view.top.location.assign(href);
      return;
    }
  } catch {
    /* blocked */
  }

  try {
    window.parent.postMessage({ type: CLICKORA_OFFER_NAV_MESSAGE, href }, window.location.origin);
  } catch {
    /* ignore */
  }
}
