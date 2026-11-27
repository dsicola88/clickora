/**
 * Boot de consentimento para HTML exportado (fora da SPA).
 * Gate cookies: marketing só após Aceitar; GCM v2 default denied (só se há Google).
 * Sem gate: marketing imediato (comportamento histórico).
 */

import { DEFAULT_COOKIE_CONSENT_STORAGE_KEY } from "@/page-builder/cookieConsentStorage";
import type { PresellCookieLayout } from "@/lib/presellCookieBannerStyles";

export type ExportMarketingBundle = {
  headHtml: string;
  bodyHtml: string;
  footerHtml: string;
};

function joinHtml(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join("\n");
}

/** Stub GCM + default denied (idempotente no browser). */
export function buildGoogleConsentModeDefaultScript(): string {
  return `<script>(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;if(!window.__clickoraGcmDefaultsApplied){gtag("consent","default",{ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"denied",wait_for_update:500});window.__clickoraGcmDefaultsApplied=1;}})();</script>`;
}

/**
 * Head precoce + cauda de body para export.
 * Com cookieGate, marketing vai no boot JS (não no head estático).
 */
export function buildExportConsentAwareSnippets(opts: {
  cookieGate: boolean;
  clickoraHead: string;
  marketing: ExportMarketingBundle;
  /** strict non-cookie: GCM denied sem diferir marketing. */
  applyConsentModeDefaults?: boolean;
  consentModeDefaultDenied?: boolean;
  /** Só emitir stub GCM se a página tiver Google (Ads/GA/GTM). Default true (legado). */
  hasGoogleTags?: boolean;
}): { earlyHead: string; bodyStart: string; bodyEnd: string; cookieBootInline: boolean } {
  const clickora = opts.clickoraHead.trim();
  const headM = opts.marketing.headHtml.trim();
  const bodyM = opts.marketing.bodyHtml.trim();
  const footM = opts.marketing.footerHtml.trim();
  const hasGoogle = opts.hasGoogleTags !== false;
  const gcmDenied = opts.consentModeDefaultDenied !== false;
  /** Cookie gate sempre usa GCM quando há Google; sem gate só se applyConsentModeDefaults. */
  const useGcm = hasGoogle && (opts.cookieGate || opts.applyConsentModeDefaults === true);

  if (!opts.cookieGate) {
    const gcm =
      useGcm && gcmDenied
        ? buildGoogleConsentModeDefaultScript()
        : useGcm && !gcmDenied
          ? `<script>(function(){window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=window.gtag||gtag;if(!window.__clickoraGcmDefaultsApplied){gtag("consent","default",{ad_storage:"granted",ad_user_data:"granted",ad_personalization:"granted",analytics_storage:"granted"});window.__clickoraGcmDefaultsApplied=1;}})();</script>`
          : "";
    return {
      earlyHead: joinHtml([gcm, clickora, headM]),
      bodyStart: bodyM,
      bodyEnd: footM,
      cookieBootInline: false,
    };
  }

  const payload = JSON.stringify({
    head: headM,
    body: bodyM,
    footer: footM,
  });
  const key = DEFAULT_COOKIE_CONSENT_STORAGE_KEY;
  const boot = `<script>(function(){
var KEY=${JSON.stringify(key)};
var CHOICE=KEY+":choice";
var PAYLOAD=${payload};
var USE_GCM=${useGcm ? "1" : "0"};
function gtag(){window.dataLayer=window.dataLayer||[];window.dataLayer.push(arguments);}
if(USE_GCM)window.gtag=window.gtag||gtag;
function update(allowed){if(!USE_GCM)return;gtag("consent","update",{ad_storage:allowed?"granted":"denied",ad_user_data:allowed?"granted":"denied",ad_personalization:allowed?"granted":"denied",analytics_storage:allowed?"granted":"denied"});}
function mark(n){try{if(n&&n.setAttribute)n.setAttribute("data-clickora-mkt","1");}catch(e){}}
function injectHtml(html,parent){if(!html||!parent)return;var d=document.createElement("div");d.innerHTML=html;var nodes=[].slice.call(d.childNodes);for(var i=0;i<nodes.length;i++){var n=nodes[i];if(n.nodeName==="SCRIPT"){var s=document.createElement("script");for(var a=0;a<n.attributes.length;a++){var at=n.attributes[a];s.setAttribute(at.name,at.value);}if(n.src)s.src=n.src;else s.text=n.textContent||"";mark(s);parent.appendChild(s);}else{mark(n);parent.appendChild(n);}}}
function teardownMarketing(){try{var nodes=document.querySelectorAll('[data-clickora-mkt="1"]');for(var i=0;i<nodes.length;i++){nodes[i].parentNode&&nodes[i].parentNode.removeChild(nodes[i]);}}catch(e){}window.__clickoraMarketingInjected=0;}
function unlockMarketing(){if(window.__clickoraMarketingInjected)return;window.__clickoraMarketingInjected=1;update(true);injectHtml(PAYLOAD.head,document.head);var mount=document.querySelector('[data-presell-inject="body-start"]')||document.body;injectHtml(PAYLOAD.body,mount);injectHtml(PAYLOAD.footer,document.body);}
function setChoice(c){try{localStorage.setItem(KEY,"1");localStorage.setItem(CHOICE,c);}catch(e){}}
function readChoice(){try{var v=localStorage.getItem(CHOICE);if(v==="all"||v==="essential")return v;if(localStorage.getItem(KEY)==="1")return"essential";}catch(e){}return null;}
function hideOverlay(){var o=document.getElementById("pe-cookie-overlay");if(o)o.style.display="none";}
function showOverlay(){var o=document.getElementById("pe-cookie-overlay");if(o)o.style.display="";}
/* «Cookie settings» só depois de Aceitar; após Fechar o banner volta expandido no próximo carregamento. */
function setReopen(on){var r=document.getElementById("pe-cookie-reopen");if(r)r.style.display=on?"":"none";}
window.__clickoraCookieConsent={
  accept:function(){setChoice("all");unlockMarketing();hideOverlay();setReopen(true);},
  essential:function(){setChoice("essential");teardownMarketing();update(false);hideOverlay();setReopen(false);},
  reopen:function(){try{localStorage.removeItem(KEY);localStorage.removeItem(CHOICE);}catch(e){}teardownMarketing();update(false);showOverlay();setReopen(false);}
};
var existing=readChoice();
if(existing==="all"){unlockMarketing();hideOverlay();}
else{update(false);}
})();</script>`;

  return {
    earlyHead: joinHtml([
      useGcm ? buildGoogleConsentModeDefaultScript() : "",
      clickora,
      boot,
    ]),
    bodyStart: "",
    bodyEnd: "",
    cookieBootInline: true,
  };
}

/**
 * Liga botões do modal export ao boot de consentimento + política in-page.
 * Também reserva espaço no fim da página enquanto o banner está visível (último CTA alcançável)
 * e esconde o banner se já existe escolha guardada (o boot corre no <head>, antes do overlay existir).
 */
export function buildExportCookieModalBindingsScript(
  layout: PresellCookieLayout = "bar",
): string {
  const key = JSON.stringify(DEFAULT_COOKIE_CONSENT_STORAGE_KEY);
  return `<script>(function(){
var KEY=${key};var LAYOUT=${JSON.stringify(layout)};
function showPolicy(on){var s=document.getElementById("pe-cookie-policy-sheet");if(!s)return;s.hidden=!on;s.style.display=on?"flex":"none";}
function reserve(){var o=document.getElementById("pe-cookie-overlay"),c=document.getElementById("pe-cookie-card");if(!o||!c)return;var h=0;if(o.style.display!=="none"){var r=c.getBoundingClientRect();if(r.height>0){var full=r.width>=window.innerWidth*0.9;if(!(LAYOUT==="corner"&&!full))h=Math.ceil(r.height+(LAYOUT==="floating"?24:0));}}var bs=document.body.style,rs=document.documentElement.style;if(h){bs.setProperty("padding-bottom",h+"px");rs.setProperty("scroll-padding-bottom",h+"px");}else{bs.removeProperty("padding-bottom");rs.removeProperty("scroll-padding-bottom");}}
function hasAll(){try{return localStorage.getItem(KEY+":choice")==="all";}catch(e){return false;}}
function bind(){var api=window.__clickoraCookieConsent;if(!api)return;
var c=document.getElementById("pe-cookie-close");
var a=document.getElementById("pe-cookie-allow");
var r=document.getElementById("pe-cookie-reopen");
var p=document.getElementById("pe-cookie-policy");
var pb=document.getElementById("pe-cookie-policy-back");
var pd=document.getElementById("pe-cookie-policy-backdrop");
var o=document.getElementById("pe-cookie-overlay");
if(o&&hasAll())o.style.display="none";
if(r&&!hasAll())r.style.display="none";
if(c)c.addEventListener("click",function(){api.essential();reserve();});
if(a)a.addEventListener("click",function(){api.accept();reserve();});
if(r)r.addEventListener("click",function(){api.reopen();reserve();});
if(p)p.addEventListener("click",function(e){e.preventDefault();showPolicy(true);});
if(pb)pb.addEventListener("click",function(){showPolicy(false);});
if(pd)pd.addEventListener("click",function(){showPolicy(false);});
window.addEventListener("resize",reserve);
if(window.ResizeObserver){var card=document.getElementById("pe-cookie-card");if(card)new ResizeObserver(reserve).observe(card);}
reserve();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();</script>`;
}
