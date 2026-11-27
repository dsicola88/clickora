/**
 * Script público `/track/v2/clickora.min.js` (pageview em presells `/p/{uuid}`).
 *
 * Servido legível e comentado de propósito: código minificado numa linha que lê cookies e faz
 * POST para outro domínio é o perfil que os scanners de malware associam a skimmers.
 * Mantém-se async-safe (não depende só de `document.currentScript`).
 */
export const CLICKORA_EMBED_JS = String.raw`/*!
 * dclickora pageview tracker — https://www.dclickora.com
 * Envia 1 evento "pageview" para a API dclickora com: id da presell, URL da página, referrer,
 * IDs de clique dos anúncios (gclid/gbraid/wbraid/fbclid/ttclid/msclkid), UTMs e os cookies
 * _fbp/_ttp quando existem. Não altera a página, não redireciona e não escreve cookies.
 */
(function () {
  "use strict";

  function findOwnScript() {
    var current = document.currentScript;
    if (current && current.src) return current;
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && /clickora\.min\.js/i.test(scripts[i].src)) return scripts[i];
    }
    return null;
  }

  function readCookie(name) {
    var all = document.cookie || "";
    var match = all.match(new RegExp("(?:^|;)\\s*" + name + "=([^;]+)"));
    if (!match) return "";
    try {
      return decodeURIComponent(match[1].trim());
    } catch (e) {
      return "";
    }
  }

  var script = findOwnScript();
  if (!script || !script.src) return;

  var scriptUrl = new URL(script.src);
  var apiBase =
    script.getAttribute("data-api-base") ||
    scriptUrl.origin + scriptUrl.pathname.replace(/\/track\/v2\/clickora\.min\.js$/i, "");
  var userId = script.getAttribute("data-id") || "";
  var explicitPresellId = (script.getAttribute("data-presell-id") || "").trim();
  var pathMatch = location.pathname.match(/\/p\/([a-f0-9-]{36})/i);
  var presellId = explicitPresellId || (pathMatch && pathMatch[1]) || "";
  if (!presellId) return;

  var payload = {
    presell_id: presellId,
    event_type: "pageview",
    referrer: document.referrer || undefined,
  };

  var metadata = {};
  if (userId) metadata.clickora_user_id = userId;
  try {
    if (location.href) {
      metadata.landing_url = String(location.href).slice(0, 2000);
      metadata.page_url = metadata.landing_url;
    }
    var query = new URLSearchParams(location.search || "");
    [
      "gclid", "gbraid", "wbraid", "gad_source", "gad_campaignid",
      "fbclid", "ttclid", "msclkid",
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    ].forEach(function (key) {
      var value = query.get(key);
      if (value) metadata[key] = value;
    });
  } catch (e) {}

  try {
    var fbp = readCookie("_fbp");
    if (fbp) metadata.fbp = fbp;
    var ttp = readCookie("_ttp");
    if (ttp) metadata.ttp = ttp;
  } catch (e) {}

  if (Object.keys(metadata).length) payload.metadata = metadata;

  try {
    fetch(apiBase + "/track/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
      keepalive: true,
      mode: "cors",
    });
  } catch (e) {}
})();
`;
