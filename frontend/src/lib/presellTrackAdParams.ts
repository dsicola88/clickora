/**
 * Parâmetros de anúncio/UTM a copiar da URL da lander para `/track/r/…`
 * e (via servidor) para o hoplink — sem sobrescrever chaves já presentes.
 */
export const PRESELL_TRACK_AD_PARAM_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "gad_source",
  "gad_campaignid",
  "msclkid",
  "fbclid",
  "ttclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "sub1",
  "sub2",
  "sub3",
] as const;

const CLICK_ID_KEYS = new Set([
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "fbclid",
  "ttclid",
]);

function isUsableAdParamValue(raw: string, key: string): boolean {
  const v = raw.trim();
  if (!v) return false;
  if (/^\{[\w.]+\}$/.test(v) || /^\{\{/.test(v) || /^%7B[\w.]+%7D$/i.test(v)) return false;
  if (CLICK_ID_KEYS.has(key) && (v.includes("{") || v.includes("}"))) return false;
  return true;
}

/**
 * Junta query da lander a um href `/track/r/…` com `URL` / `searchParams`
 * (nunca concatena `?`/`&` à mão — evita `??` em hoplinks com query).
 */
export function mergeLandingAdParamsIntoTrackHref(
  trackHref: string,
  pageSearch: URLSearchParams | string,
): string {
  const href = trackHref.trim();
  if (!href || href === "#") return href;
  try {
    const u = new URL(href, typeof window !== "undefined" ? window.location.href : "https://local.invalid/");
    if (!/\/track\/r\//i.test(u.pathname)) return href;
    const search =
      typeof pageSearch === "string" ? new URLSearchParams(pageSearch) : pageSearch;
    for (const key of PRESELL_TRACK_AD_PARAM_KEYS) {
      if (u.searchParams.has(key)) continue;
      const raw = search.get(key);
      if (!raw || !isUsableAdParamValue(raw, key)) continue;
      u.searchParams.set(key, raw.trim());
    }
    if (!u.searchParams.has("source")) {
      const utmSource = search.get("utm_source")?.trim();
      if (utmSource && isUsableAdParamValue(utmSource, "utm_source")) {
        u.searchParams.set("source", utmSource);
      }
    }
    if (!u.searchParams.has("medium")) {
      const utmMedium = search.get("utm_medium")?.trim();
      if (utmMedium && isUsableAdParamValue(utmMedium, "utm_medium")) {
        u.searchParams.set("medium", utmMedium);
      }
    }
    if (!u.searchParams.has("campaign")) {
      const utmCampaign = search.get("utm_campaign")?.trim();
      if (utmCampaign && isUsableAdParamValue(utmCampaign, "utm_campaign")) {
        u.searchParams.set("campaign", utmCampaign);
      }
    }
    return u.toString();
  } catch {
    return href;
  }
}

/**
 * Script inline para HTML exportado: no load e no click (capture),
 * copia gclid/gad_source/UTMs da lander para todos os CTAs `/track/r/`.
 * Garante href rastreável mesmo se o visitante clicar antes de qualquer hidratação.
 */
export function buildExportTrackAdParamsBootstrapScript(): string {
  const keysJson = JSON.stringify([...PRESELL_TRACK_AD_PARAM_KEYS]);
  return `<script>(function(){var KEYS=${keysJson};var CLICK_IDS={gclid:1,gbraid:1,wbraid:1,msclkid:1,fbclid:1,ttclid:1};function usable(k,v){v=String(v||"").trim();if(!v)return false;if(/^\\{[\\w.]+\\}$/.test(v)||/^\\{\\{/.test(v)||/^%7B[\\w.]+%7D$/i.test(v))return false;if(CLICK_IDS[k]&&(v.indexOf("{")>=0||v.indexOf("}")>=0))return false;return true;}function merge(href){try{var u=new URL(href,location.href);if(!/\\/track\\/r\\//i.test(u.pathname))return href;var q=new URLSearchParams(location.search||"");for(var i=0;i<KEYS.length;i++){var k=KEYS[i];if(u.searchParams.has(k))continue;var v=q.get(k);if(v&&usable(k,v))u.searchParams.set(k,v.trim());}if(!u.searchParams.has("source")){var us=q.get("utm_source");if(us&&usable("utm_source",us))u.searchParams.set("source",us.trim());}if(!u.searchParams.has("medium")){var um=q.get("utm_medium");if(um&&usable("utm_medium",um))u.searchParams.set("medium",um.trim());}if(!u.searchParams.has("campaign")){var uc=q.get("utm_campaign");if(uc&&usable("utm_campaign",uc))u.searchParams.set("campaign",uc.trim());}return u.toString();}catch(e){return href;}}function patchAll(){var nodes=document.querySelectorAll('a[href*="track/r/"]');for(var i=0;i<nodes.length;i++){var a=nodes[i];var h=a.getAttribute("href")||"";if(!h||h==="#")continue;a.setAttribute("href",merge(h));}}function onClick(e){var t=e.target;if(!t||!t.closest)return;var a=t.closest('a[href*="track/r/"]');if(!a)return;var h=a.getAttribute("href")||a.href||"";if(!h||h==="#")return;var next=merge(h);if(next&&next!==h)a.setAttribute("href",next);}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",patchAll);else patchAll();document.addEventListener("click",onClick,true);})();</script>`;
}
