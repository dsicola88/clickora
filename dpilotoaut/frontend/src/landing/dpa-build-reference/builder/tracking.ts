/**
 * Tracking integrations for published pages.
 * Supports Google Tag Manager (GTM), Google Analytics 4 (GA4) and Meta (Facebook) Pixel.
 *
 * Auto-events emitted:
 *  - `form_submit` (params: form_id, form_name)
 *  - `button_click` (params: button_text, button_id)
 *  - `page_view` (on initial load)
 */

export interface PageTracking {
  gtmId?: string;
  ga4Id?: string;
  metaPixelId?: string;
  /** Free-form HTML injected at the end of <head>. */
  customHeadCode?: string;
  /** Free-form HTML injected at the end of <body>. */
  customBodyCode?: string;
  /** Auto-fire form_submit on every form submit. Default: true. */
  trackFormSubmits?: boolean;
  /** Auto-fire button_click on every button/link click. Default: true. */
  trackButtonClicks?: boolean;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
    _fbq?: unknown;
  }
}

/** Fire a tracked event across all configured providers (GTM dataLayer, GA4, Meta Pixel). */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...params });
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
    if (typeof window.fbq === "function") {
      // Pixel uses standard or custom events
      const standard = new Set([
        "PageView",
        "Lead",
        "CompleteRegistration",
        "Contact",
        "Purchase",
        "AddToCart",
        "InitiateCheckout",
      ]);
      const pixelName =
        name === "form_submit" ? "Lead" : name === "button_click" ? "Contact" : name;
      const track = standard.has(pixelName) ? "track" : "trackCustom";
      window.fbq(track, pixelName, params);
    }
  } catch {
    /* tracking must never break the page */
  }
}

/** Build the script tags string for direct injection (used by HTML export). */
export function buildTrackingHeadScripts(t: PageTracking): string {
  const out: string[] = [];

  if (t.gtmId) {
    out.push(`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${escapeJs(t.gtmId)}');</script>`);
  }

  if (t.ga4Id) {
    out.push(`<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeAttr(t.ga4Id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date()); gtag('config', '${escapeJs(t.ga4Id)}');</script>`);
  }

  if (t.metaPixelId) {
    out.push(`<!-- Meta Pixel -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${escapeJs(t.metaPixelId)}'); fbq('track', 'PageView');</script>`);
  }

  if (t.customHeadCode) out.push(t.customHeadCode);
  return out.join("\n");
}

/** Body-end injections (Pixel <noscript>, GTM noscript, custom). */
export function buildTrackingBodyScripts(t: PageTracking): string {
  const out: string[] = [];
  if (t.gtmId) {
    out.push(`<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeAttr(t.gtmId)}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`);
  }
  if (t.metaPixelId) {
    out.push(`<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${escapeAttr(t.metaPixelId)}&ev=PageView&noscript=1" /></noscript>`);
  }
  // Auto-event listeners (always emitted when tracking exists, even if user disabled both flags they will be no-ops)
  const trackForms = t.trackFormSubmits !== false;
  const trackButtons = t.trackButtonClicks !== false;
  if (trackForms || trackButtons) {
    out.push(`<script>
(function(){
  function emit(name, params){
    try {
      if (window.dataLayer) window.dataLayer.push(Object.assign({event:name}, params||{}));
      if (typeof window.gtag === 'function') window.gtag('event', name, params||{});
      if (typeof window.fbq === 'function') {
        var pn = name === 'form_submit' ? 'Lead' : name === 'button_click' ? 'Contact' : name;
        var std = ['PageView','Lead','CompleteRegistration','Contact','Purchase','AddToCart','InitiateCheckout'];
        var fn = std.indexOf(pn) >= 0 ? 'track' : 'trackCustom';
        window.fbq(fn, pn, params||{});
      }
    } catch(e){}
  }
  ${
    trackForms
      ? `document.addEventListener('submit', function(e){
    var f = e.target;
    if (!(f instanceof HTMLFormElement)) return;
    emit('form_submit', { form_id: f.id || null, form_name: f.getAttribute('name') || null });
  }, true);`
      : ""
  }
  ${
    trackButtons
      ? `document.addEventListener('click', function(e){
    var el = e.target;
    if (!el || typeof el.closest !== 'function') return;
    var btn = el.closest('button, a[role="button"], a.btn, [data-track-click]');
    if (!btn) return;
    emit('button_click', {
      button_text: (btn.innerText || '').trim().slice(0, 80),
      button_id: btn.id || null,
      button_href: btn.getAttribute('href') || null
    });
  }, true);`
      : ""
  }
})();
</script>`);
  }
  if (t.customBodyCode) out.push(t.customBodyCode);
  return out.join("\n");
}

/**
 * Apply tracking to the current document (used by the React public route).
 * Returns a cleanup function to remove all injected nodes/listeners on unmount.
 */
export function applyTrackingToDocument(t: PageTracking): () => void {
  if (typeof document === "undefined") return () => {};
  const head = document.head;
  const body = document.body;
  const created: Element[] = [];

  const addScript = (code: string, attrs: Record<string, string> = {}) => {
    const s = document.createElement("script");
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.text = code;
    s.setAttribute("data-page-tracking", "true");
    head.appendChild(s);
    created.push(s);
  };

  const addExternal = (src: string) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    s.setAttribute("data-page-tracking", "true");
    head.appendChild(s);
    created.push(s);
  };

  if (t.gtmId) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    addExternal(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(t.gtmId)}`);
  }

  if (t.ga4Id) {
    addExternal(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(t.ga4Id)}`);
    addScript(
      `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${escapeJs(t.ga4Id)}');`,
    );
  }

  if (t.metaPixelId) {
    addScript(`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${escapeJs(t.metaPixelId)}');fbq('track','PageView');`);
  }

  if (t.customHeadCode) {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-page-tracking", "true");
    wrap.style.display = "none";
    wrap.innerHTML = t.customHeadCode;
    head.appendChild(wrap);
    created.push(wrap);
  }

  if (t.customBodyCode) {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-page-tracking", "true");
    wrap.style.display = "none";
    wrap.innerHTML = t.customBodyCode;
    body.appendChild(wrap);
    created.push(wrap);
  }

  // Auto event listeners
  const onSubmit = (e: Event) => {
    const f = e.target;
    if (!(f instanceof HTMLFormElement)) return;
    trackEvent("form_submit", {
      form_id: f.id || null,
      form_name: f.getAttribute("name") || null,
    });
  };
  const onClick = (e: Event) => {
    const el = e.target as Element | null;
    if (!el || typeof el.closest !== "function") return;
    const btn = el.closest('button, a[role="button"], a.btn, [data-track-click]');
    if (!btn) return;
    trackEvent("button_click", {
      button_text: (btn as HTMLElement).innerText?.trim().slice(0, 80) ?? null,
      button_id: btn.id || null,
      button_href: btn.getAttribute("href") || null,
    });
  };
  const trackForms = t.trackFormSubmits !== false;
  const trackButtons = t.trackButtonClicks !== false;
  if (trackForms) document.addEventListener("submit", onSubmit, true);
  if (trackButtons) document.addEventListener("click", onClick, true);

  return () => {
    if (trackForms) document.removeEventListener("submit", onSubmit, true);
    if (trackButtons) document.removeEventListener("click", onClick, true);
    created.forEach((el) => el.parentNode?.removeChild(el));
    document
      .querySelectorAll("[data-page-tracking]")
      .forEach((el) => el.parentNode?.removeChild(el));
  };
}

function escapeJs(s: string): string {
  return s.replace(/['"\\<>]/g, "");
}
function escapeAttr(s: string): string {
  return s.replace(/[<>"']/g, "");
}
