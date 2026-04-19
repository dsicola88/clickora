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
  return { awId: m[1], sendTo: t };
}

export type PresellOptionalMarketingInjection = {
  headHtml: string;
  bodyHtml: string;
  cacheKey: string;
};

/**
 * Constrói HTML para injetar após CSS/conversão manual e antes do `headerCode` guardado.
 */
export function buildPresellOptionalSettingsMarketing(
  settings: Record<string, unknown>,
): PresellOptionalMarketingInjection {
  const googleTrackingCode = String(settings.googleTrackingCode ?? "").trim();
  const googleConversionEvent = String(settings.googleConversionEvent ?? "").trim();
  const fbPixelId = String(settings.fbPixelId ?? "").trim();
  const fbTrackName = String(settings.fbTrackName ?? "").trim();

  const cacheKey = JSON.stringify({
    g: googleTrackingCode,
    c: googleConversionEvent,
    f: fbPixelId,
    t: fbTrackName,
  });

  const head: string[] = [];
  const body: string[] = [];

  const conv = googleConversionEvent ? parseConversionSendTo(googleConversionEvent) : null;

  const isGtm = /^GTM-[A-Z0-9]+$/i.test(googleTrackingCode);
  const isRawScript = googleTrackingCode.length > 0 && /<\s*script/i.test(googleTrackingCode);
  const isGa4Id = /^G-[A-Z0-9]+$/i.test(googleTrackingCode);
  const isAwOnlyId = /^AW-[0-9]+$/i.test(googleTrackingCode);

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
  } else if (isRawScript) {
    head.push(`<!-- Google: snippet colado (opcional presell) -->\n${googleTrackingCode}`);
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

  const useStructuredGtag = !isGtm && !isRawScript && (gtagConfigIds.length > 0 || !!conv);

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
        gtagConfigIds[0];
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

  if (/^\d+$/.test(fbPixelId)) {
    const pid = fbPixelId;
    const extra = fbTrackName.trim()
      ? `fbq('trackCustom',${JSON.stringify(fbTrackName.trim())});`
      : "";
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

  return {
    headHtml: head.filter(Boolean).join("\n"),
    bodyHtml: body.filter(Boolean).join("\n"),
    cacheKey,
  };
}
