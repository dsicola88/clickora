import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeCustomCodeRisk } from "./customCodeRisk";

const GTM_HEAD = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXX');</script>`;
const GTM_BODY = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXX"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
const GTAG = `<script async src="https://www.googletagmanager.com/gtag/js?id=AW-1"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','AW-1',{page_location: window.location.href});</script>`;
const META_PIXEL = `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '123');fbq('track', 'PageView');</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=123&ev=PageView&noscript=1"/></noscript>`;

describe("analyzeCustomCodeRisk", () => {
  it("snippets oficiais (GTM, gtag com page_location, Meta Pixel) não são sinalizados", () => {
    assert.deepEqual(analyzeCustomCodeRisk([GTM_HEAD, GTM_BODY, GTAG, META_PIXEL]), { hijack: [], obfuscation: [] });
  });

  it("vazio / nulo", () => {
    assert.deepEqual(analyzeCustomCodeRisk([null, undefined, "  "]), { hijack: [], obfuscation: [] });
  });

  it("detecta redirect, popup, popstate, minerador e iframe oculto de terceiros", () => {
    const r = analyzeCustomCodeRisk([
      `<script>setTimeout(function(){window.location.href="https://evil.example"},3000)</script>`,
      `<script>location.replace("https://x.test")</script>`,
      `<meta http-equiv="refresh" content="0;url=https://x.test">`,
      `<script>document.onclick=function(){window.open("https://pop.test")}</script>`,
      `<script>history.pushState(null,"",location.href);window.addEventListener("popstate",function(){})</script>`,
      `<script src="https://coinhive.com/lib/coinhive.min.js"></script>`,
      `<iframe src="https://evil.example/frame" width="0" height="0"></iframe>`,
    ]);
    assert.deepEqual(r.hijack, [
      "redirect via location =",
      "redirect via location.replace/assign",
      "meta refresh",
      "window.open (popup/popunder)",
      "sequestro do botão voltar (popstate)",
      "minerador de cripto",
      "iframe invisível",
    ]);
  });

  it("não confunde declaração/comparação com redirect", () => {
    const r = analyzeCustomCodeRisk([`<script>var location = "x"; if (a.location == b) {} const href = location.href;</script>`]);
    assert.deepEqual(r.hijack, []);
  });

  it("detecta ofuscação", () => {
    const r = analyzeCustomCodeRisk([
      `<script>eval(atob("ZG9jdW1lbnQ="));document.write(String.fromCharCode(60));unescape("%3C");new Function("x")</script>`,
      `<script>var s="\\x68\\x74\\x74\\x70\\x73\\x3a\\x2f\\x2f\\x65\\x76\\x69\\x6c\\x2e";</script>`,
    ]);
    assert.deepEqual(r.obfuscation, [
      "eval()",
      "new Function()",
      "atob()",
      "String.fromCharCode",
      "unescape()",
      "document.write()",
      "sequência longa de escapes hex/unicode",
    ]);
  });
});
