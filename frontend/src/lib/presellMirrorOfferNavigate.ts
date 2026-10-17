export const CLICKORA_OFFER_NAV_MESSAGE = "clickora:offer-navigate";

/** Navega a janela principal para o hoplink rastreado (iframe sandbox-safe). */
export function navigatePresellOfferFromMirrorEvent(e: Event, dest: string): void {
  const href = dest.trim();
  if (!href || href === "#") return;

  const doc =
    e.currentTarget instanceof Document
      ? e.currentTarget
      : (e.target instanceof Node ? e.target.ownerDocument : null);
  const view = doc?.defaultView ?? null;

  const tryAssign = (w: Window | null | undefined) => {
    if (!w) return false;
    try {
      w.location.assign(href);
      return true;
    } catch {
      try {
        w.location.href = href;
        return true;
      } catch {
        return false;
      }
    }
  };

  if (view) {
    try {
      if (view.top && view.top !== view && tryAssign(view.top)) return;
    } catch {
      /* blocked top reference */
    }
    if (tryAssign(view)) return;
  }

  try {
    window.parent.postMessage({ type: CLICKORA_OFFER_NAV_MESSAGE, href }, window.location.origin);
  } catch {
    /* ignore */
  }
  tryAssign(window);
}
