/**
 * Gera snippets de head/body a partir dos campos opcionais da presell (painel).
 * Cada página pública usa só os `settings` dessa presell — adequado a multi-tenant (sem estado partilhado).
 */

function escapeJs(s: string): string {
  return s.replace(/['"\\<>]/g, "");
}

function escapeAttr(s: string): string {
  return s.replace(/[<>"']/g, "");
}

function parseConversionSendTo(raw: string): { awId: string; sendTo: string } | null {
  const t = raw.trim();
  const m = t.match(/^(AW-[0-9]+)\/(.+)$/i);
  if (!m) return null;
  return { awId: m[1]!, sendTo: t };
}

/** Extrai ID Meta (10–20 dígitos) de cola suja / script completo. */
export function normalizeMetaPixelId(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const fromInit = t.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/i);
  if (fromInit?.[1]) return fromInit[1];
  const fromTr = t.match(/facebook\.com\/tr\?[^"'>\s]*[?&]id=(\d{10,20})/i);
  if (fromTr?.[1]) return fromTr[1];
  if (/^\d{10,20}$/.test(t)) return t;
  const spaced = t.replace(/[\s,._-]+/g, "");
  if (/^\d{10,20}$/.test(spaced)) return spaced;
  const embedded = t.match(/\b(\d{10,20})\b/);
  return embedded?.[1] ?? "";
}

/** Extrai Pixel ID TikTok de cola suja / `ttq.load('…')` / `sdkid=`. Sem match guloso em texto livre. */
export function normalizeTikTokPixelId(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const fromLoad = t.match(/ttq\.load\s*\(\s*['"]([A-Z0-9]{10,64})['"]/i);
  if (fromLoad?.[1]) return fromLoad[1];
  const fromSdk = t.match(/[?&]sdkid=([A-Z0-9]{10,64})/i);
  if (fromSdk?.[1]) return fromSdk[1];
  /** ID limpo (Events Manager): tipicamente começa por letra. */
  if (/^[A-Z][A-Z0-9]{9,63}$/i.test(t)) return t;
  if (/^[A-Z0-9]{10,64}$/i.test(t)) return t;
  return "";
}

/** Extrai UET tag ID Bing (só dígitos). */
export function normalizeBingUetTagId(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const fromTi = t.match(/\bti\s*[:=]\s*['"]?(\d{4,20})['"]?/i);
  if (fromTi?.[1]) return fromTi[1];
  if (/^\d{4,20}$/.test(t)) return t;
  const spaced = t.replace(/[\s,._-]+/g, "");
  if (/^\d{4,20}$/.test(spaced)) return spaced;
  const embedded = t.match(/\b(\d{4,20})\b/);
  return embedded?.[1] ?? "";
}

/** Normaliza campo Google: G- / GTM- / AW- / snippet &lt;script&gt; / texto com ID embutido. */
export function normalizeGoogleTrackingCode(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/<\s*script/i.test(t)) return t;
  if (/^GTM-[A-Z0-9]+$/i.test(t)) return t.toUpperCase();
  if (/^G-[A-Z0-9]+$/i.test(t)) return t.toUpperCase();
  if (/^AW-[0-9]+$/i.test(t)) return `AW-${t.replace(/^AW-/i, "")}`;
  const gtm = t.match(/\b(GTM-[A-Z0-9]+)\b/i);
  if (gtm?.[1]) return gtm[1].toUpperCase();
  const ga4 = t.match(/\b(G-[A-Z0-9]+)\b/i);
  if (ga4?.[1]) return ga4[1].toUpperCase();
  const aw = t.match(/\b(AW-[0-9]+)\b/i);
  if (aw?.[1]) return aw[1].toUpperCase();
  return t;
}

export function normalizeGoogleConversionEvent(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const m = t.match(/\b(AW-[0-9]+\/[A-Za-z0-9_-]+)\b/);
  return m?.[1] ?? t;
}

/** Snippets já colados (manual / head) — evita pixel duplicado em modo auto. */
export function detectPastedAdPixelBases(html: string): {
  meta: boolean;
  tiktok: boolean;
  bing: boolean;
  google: boolean;
} {
  const h = html || "";
  return {
    meta: /fbevents\.js|fbq\s*\(\s*['"]init['"]/i.test(h),
    tiktok: /analytics\.tiktok\.com|ttq\.load\s*\(/i.test(h),
    bing: /bat\.bing\.com|uetq/i.test(h),
    google: /googletagmanager\.com\/gtag|googletagmanager\.com\/gtm\.js|GTM-|gtag\s*\(/i.test(h),
  };
}

export type PresellOptionalMarketingInjection = {
  headHtml: string;
  bodyHtml: string;
  cacheKey: string;
};

function isManualPixelsMode(settings: Record<string, unknown>): boolean {
  return String(settings.adPixelsMode ?? "auto").trim().toLowerCase() === "manual";
}

function mergePixelBases(
  a: ReturnType<typeof detectPastedAdPixelBases>,
  b: ReturnType<typeof detectPastedAdPixelBases>,
) {
  return {
    meta: a.meta || b.meta,
    tiktok: a.tiktok || b.tiktok,
    bing: a.bing || b.bing,
    google: a.google || b.google,
  };
}

function pastedBasesFromSettings(settings: Record<string, unknown>) {
  const blob = [
    String(settings.conversionTrackingScript ?? ""),
    String(settings.headerCode ?? ""),
    String(settings.bodyCode ?? ""),
    String(settings.footerCode ?? ""),
    String(settings.googleTrackingCode ?? ""),
  ].join("\n");
  return detectPastedAdPixelBases(blob);
}

const META_STANDARD_EVENTS = new Set([
  "PageView",
  "Lead",
  "ViewContent",
  "Purchase",
  "AddToCart",
  "InitiateCheckout",
  "CompleteRegistration",
  "Search",
  "Contact",
  "Subscribe",
  "AddPaymentInfo",
  "AddToWishlist",
  "StartTrial",
  "SubmitApplication",
  "Schedule",
  "FindLocation",
  "CustomizeProduct",
  "Donate",
]);

function metaTrackCall(eventName: string): string {
  const name = eventName.trim();
  if (!name) return "";
  const isStandard = META_STANDARD_EVENTS.has(name);
  const fn = isStandard ? "track" : "trackCustom";
  return `fbq('${fn}',${JSON.stringify(name)});`;
}

/**
 * Constrói HTML para injetar após CSS/conversão manual e antes do `headerCode` guardado.
 */
export function buildPresellOptionalSettingsMarketing(
  settings: Record<string, unknown>,
): PresellOptionalMarketingInjection {
  const mode = isManualPixelsMode(settings) ? "manual" : "auto";
  const googleTrackingCode = normalizeGoogleTrackingCode(String(settings.googleTrackingCode ?? ""));
  const googleConversionEvent = normalizeGoogleConversionEvent(String(settings.googleConversionEvent ?? ""));
  const fbPixelId = normalizeMetaPixelId(String(settings.fbPixelId ?? ""));
  const fbTrackName = String(settings.fbTrackName ?? "").trim();
  const tiktokPixelId = normalizeTikTokPixelId(String(settings.tiktokPixelId ?? ""));
  const bingUetTagId = normalizeBingUetTagId(String(settings.bingUetTagId ?? ""));
  const isRawScript = googleTrackingCode.length > 0 && /<\s*script/i.test(googleTrackingCode);
  /** Script colado no campo Google pode ser Meta/TikTok/etc. — marca essas bases como já presentes. */
  let already = pastedBasesFromSettings(settings);
  if (isRawScript) {
    already = mergePixelBases(already, detectPastedAdPixelBases(googleTrackingCode));
  }

  const cacheKey = JSON.stringify({
    mode,
    g: googleTrackingCode,
    c: googleConversionEvent,
    f: fbPixelId,
    t: fbTrackName,
    tk: tiktokPixelId,
    b: bingUetTagId,
    skip: already,
  });

  /** Em modo manual os IDs não geram script — o utilizador cola o snippet em conversionTrackingScript / head. */
  if (mode === "manual") {
    return { headHtml: "", bodyHtml: "", cacheKey };
  }

  const head: string[] = [];
  const body: string[] = [];

  const conv = googleConversionEvent ? parseConversionSendTo(googleConversionEvent) : null;

  const isGtm = /^GTM-[A-Z0-9]+$/i.test(googleTrackingCode);
  const isGa4Id = /^G-[A-Z0-9]+$/i.test(googleTrackingCode);
  const isAwOnlyId = /^AW-[0-9]+$/i.test(googleTrackingCode);

  if (isRawScript) {
    head.push(`<!-- Snippet colado (campo Google / tag) -->\n${googleTrackingCode}`);
  } else if (!already.google) {
    if (isGtm) {
      const id = googleTrackingCode.toUpperCase();
      head.push(`<!-- Google Tag Manager (opcional presell) -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${escapeJs(id)}');</script>`);
      body.push(`<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeAttr(id)}"
height="0" width="0" style="display:none;visibility:hidden" title="GTM"></iframe></noscript>`);
    } else if (googleTrackingCode.length > 0 && !isGa4Id && !isAwOnlyId) {
      head.push(
        `<!-- Clickora: «Google Analytics/tag» não reconhecido — usa G-…, GTM-…, AW-… ou cola o &lt;script&gt; completo. -->`,
      );
    }

    const gtagConfigIds: string[] = [];
    if (isGa4Id) gtagConfigIds.push(googleTrackingCode.toUpperCase());
    if (isAwOnlyId) gtagConfigIds.push(googleTrackingCode.toUpperCase());
    if (conv && !gtagConfigIds.some((id) => id === conv.awId.toUpperCase())) {
      gtagConfigIds.unshift(conv.awId.toUpperCase());
    }

    const useStructuredGtag = !isGtm && (gtagConfigIds.length > 0 || !!conv);

    if (useStructuredGtag) {
      if (gtagConfigIds.length === 0 && conv) {
        const { awId, sendTo } = conv;
        head.push(`<!-- Google Ads conversão (opcional presell) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeAttr(awId)}"></script>
<script>
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${escapeJs(awId)}');
gtag('event', 'conversion', { send_to: '${escapeJs(sendTo)}' });
</script>`);
      } else if (gtagConfigIds.length > 0) {
        const primary =
          gtagConfigIds.find((id) => id.startsWith("G-")) ||
          gtagConfigIds.find((id) => id.startsWith("AW-")) ||
          gtagConfigIds[0]!;
        head.push(`<!-- gtag opcional presell -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeAttr(primary)}"></script>
<script>
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${[...new Set(gtagConfigIds)].map((id) => `gtag('config', '${escapeJs(id)}');`).join("\n")}
${conv ? `gtag('event', 'conversion', { send_to: '${escapeJs(conv.sendTo)}' });` : ""}
</script>`);
      }
    }
  } else if (conv) {
    /* already.google — conversão AW deve viver no snippet/GTM colado */
  }

  if (!already.meta && /^\d{10,20}$/.test(fbPixelId)) {
    const pid = fbPixelId;
    const extra = metaTrackCall(fbTrackName);
    head.push(`<!-- Meta Pixel (opcional presell) -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${escapeJs(pid)}');fbq('track','PageView');${extra}</script>`);
    body.push(`<noscript><img height="1" width="1" style="display:none" alt=""
src="https://www.facebook.com/tr?id=${escapeAttr(pid)}&ev=PageView&noscript=1" /></noscript>`);
  }

  if (!already.tiktok && /^[A-Z0-9]{10,64}$/i.test(tiktokPixelId)) {
    const tid = tiktokPixelId;
    head.push(`<!-- TikTok Pixel (opcional presell) -->
<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${escapeJs(tid)}');ttq.page()}(window,document,'ttq');</script>`);
  }

  if (!already.bing && /^\d{4,20}$/.test(bingUetTagId)) {
    const bid = bingUetTagId;
    head.push(`<!-- Microsoft Advertising UET (opcional presell) -->
<script>(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"${escapeJs(bid)}"};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")},n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","//bat.bing.com/bat.js","uetq");</script>`);
  }

  return {
    headHtml: head.filter(Boolean).join("\n"),
    bodyHtml: body.filter(Boolean).join("\n"),
    cacheKey,
  };
}
