/**
 * Cloudflare Worker — hop de oferta alinhado ao origin `/track/r/`.
 *
 * 1) Destino + network + cloak (cache origin)
 * 2) Cloak geo → fallback origin (safe page)
 * 3) POST /track/click sync (IP/país/secret) → sem click_id → fallback origin
 * 4) 302 oferta com params de rede (appendClickId) + ads/UTM selectivos
 *
 * ORIGIN_API_BASE deve ser o API Railway (nunca o hostname deste Worker).
 */
const DEST_TTL_MS = 60_000;
const memory = new Map();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Espelha outboundClickParams.OUTBOUND + UNKNOWN_OUTBOUND_KEYS. */
const OUTBOUND = {
  digistore24: ["cid", "sid1"],
  buygoods: ["subid", "subid2"],
  maxweb: ["subid", "subid2"],
  smartadv: ["sub3"],
  hotmart: ["src", "sck"],
  clickbank: ["tid"],
  warriorplus: ["tid"],
  jvzoo: ["tid"],
  monetizze: ["src", "sck"],
  braip: ["xcod"],
  adcombo: ["clickid"],
  everflow: ["sub1"],
  eduzz: ["tracker"],
  leadbit: ["subid"],
  drcash: ["sub1"],
  maxbounty: ["s1"],
};
const UNKNOWN_OUTBOUND_KEYS = ["subid", "subid1", "subid2"];
const REPLACEABLE_NON_UUID_KEYS = new Set([
  "subid",
  "subid1",
  "subid2",
  "sub3",
  "sid1",
  "src",
  "sck",
  "tid",
  "clickid",
  "xcod",
  "tracker",
  "sub1",
  "s1",
]);

/** Mesmas chaves que origin `forwardAdQueryToUrl` no hop `/track/r/`. */
const FORWARD_AD_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "fbclid",
  "ttclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbp",
  "ttp",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function originApiBase(env) {
  return String(env.ORIGIN_API_BASE || "").replace(/\/+$/, "");
}

function edgeAuthHeaders(env) {
  const headers = { accept: "application/json" };
  if (env.TRACK_EDGE_SHARED_SECRET) {
    headers["x-clickora-edge-secret"] = env.TRACK_EDGE_SHARED_SECRET;
  }
  return headers;
}

function originTrackRedirect(env, presellId, search) {
  const base = originApiBase(env);
  if (!base) return null;
  return Response.redirect(`${base}/track/r/${encodeURIComponent(presellId)}${search || ""}`, 302);
}

async function fetchDest(env, presellId) {
  const hit = memory.get(presellId);
  if (hit && Date.now() < hit.exp) return hit.value;

  const base = originApiBase(env);
  if (!base) return null;
  const res = await fetch(`${base}/track/edge/dest/${encodeURIComponent(presellId)}`, {
    headers: edgeAuthHeaders(env),
  });
  if (!res.ok) return null;
  const body = await res.json();
  if (!body?.destination || body.status !== "published") return null;
  memory.set(presellId, { exp: Date.now() + DEST_TTL_MS, value: body });
  return body;
}

function usableAdValue(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\{+[A-Z0-9_.-]+\}+$/i.test(trimmed)) return null;
  return trimmed;
}

/** Espelha forwardAdQueryToUrl — só ads/UTM; não despeja a query inteira. */
function forwardAdQuery(destUrl, searchParams) {
  try {
    const u = new URL(destUrl);
    for (const key of FORWARD_AD_KEYS) {
      const usable = usableAdValue(searchParams.get(key));
      if (!usable || u.searchParams.has(key)) continue;
      u.searchParams.set(key, usable);
    }
    return u.toString();
  } catch {
    return destUrl;
  }
}

function platformIdFromOfferHost(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (
    host === "digistore24.com" ||
    host.endsWith(".digistore24.com") ||
    host === "checkout-ds24.com" ||
    host.endsWith(".checkout-ds24.com")
  ) {
    return "digistore24";
  }
  if (host === "buygoods.com" || host.endsWith(".buygoods.com")) return "buygoods";
  if (
    host === "maxweb.com" ||
    host.endsWith(".maxweb.com") ||
    /^m\d+w\.com$/.test(host) ||
    host.startsWith("mweb")
  ) {
    return "maxweb";
  }
  if (host === "hotmart.com" || host.endsWith(".hotmart.com") || host === "pay.hotmart.com") {
    return "hotmart";
  }
  if (
    host.endsWith(".clickbank.net") ||
    host === "clickbank.net" ||
    host.endsWith(".clickbank.com") ||
    host === "clickbank.com"
  ) {
    return "clickbank";
  }
  if (host === "warriorplus.com" || host.endsWith(".warriorplus.com")) return "warriorplus";
  if (host === "jvzoo.com" || host.endsWith(".jvzoo.com")) return "jvzoo";
  if (host.includes("smartadv") || host.endsWith(".smartadv.com")) return "smartadv";
  return null;
}

function canonicalPlatformId(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (!s) return null;
  const aliases = {
    digistore: "digistore24",
    digistore24: "digistore24",
    ds24: "digistore24",
    buygoods: "buygoods",
    maxweb: "maxweb",
    smartadv: "smartadv",
    hotmart: "hotmart",
    clickbank: "clickbank",
    warriorplus: "warriorplus",
    jvzoo: "jvzoo",
    monetizze: "monetizze",
    braip: "braip",
    adcombo: "adcombo",
    everflow: "everflow",
    eduzz: "eduzz",
    leadbit: "leadbit",
    drcash: "drcash",
    maxbounty: "maxbounty",
  };
  return aliases[s] || (OUTBOUND[s] ? s : null);
}

function shouldWriteNetworkParam(key, existing) {
  if (existing == null || String(existing).trim() === "") return true;
  if (UUID_RE.test(String(existing).trim())) return false;
  return REPLACEABLE_NON_UUID_KEYS.has(key);
}

/** Espelha appendClickIdToAffiliateUrl(dest, id, platform). */
function appendClickId(destUrl, clickId, platform) {
  let platformId = canonicalPlatformId(platform);
  if (!platformId) {
    try {
      platformId = platformIdFromOfferHost(new URL(destUrl).hostname);
    } catch {
      const m = String(destUrl).match(/^https?:\/\/([^/?#]+)/i);
      platformId = m ? platformIdFromOfferHost(m[1]) : null;
    }
  }
  const keys = platformId && OUTBOUND[platformId] ? OUTBOUND[platformId] : UNKNOWN_OUTBOUND_KEYS;
  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    for (const key of keys) {
      if (shouldWriteNetworkParam(key, u.searchParams.get(key))) {
        u.searchParams.set(key, clickId);
      }
    }
    return u.toString();
  } catch {
    const sep = destUrl.includes("?") ? "&" : "?";
    const parts = [`clickora_click_id=${encodeURIComponent(clickId)}`];
    for (const key of keys) {
      parts.push(`${key}=${encodeURIComponent(clickId)}`);
    }
    return `${destUrl}${sep}${parts.join("&")}`;
  }
}

function cloakGeoDenied(dest, request) {
  if (!dest?.enterprise_cloak) return false;
  const denyRaw = String(dest.cloak_geo_deny || "")
    .split(/[,;\s]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (denyRaw.length === 0) return false;
  const code = String(request.headers.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
  // Sem país CF fiável → origin decide (fail-closed; evita abrir oferta quando o origin cloakearia).
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return true;
  return denyRaw.includes(code);
}

function visitorIpFromRequest(request) {
  const cf = String(request.headers.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const xff = String(request.headers.get("x-forwarded-for") || "")
    .split(",")[0]
    ?.trim();
  return xff || "";
}

async function createClick(env, presellId, request, url, redirectTo) {
  const base = originApiBase(env);
  if (!base) return null;
  const visitorIp = visitorIpFromRequest(request);
  if (!visitorIp) return null;

  const parentRaw =
    url.searchParams.get("parent_click_id") || url.searchParams.get("clickora_click_id") || "";
  const parent_click_id = UUID_RE.test(parentRaw) ? parentRaw : undefined;

  const body = {
    presell_id: presellId,
    source: url.searchParams.get("utm_source") || url.searchParams.get("source") || undefined,
    medium: url.searchParams.get("utm_medium") || url.searchParams.get("medium") || undefined,
    campaign: url.searchParams.get("utm_campaign") || url.searchParams.get("campaign") || undefined,
    referrer: request.headers.get("referer") || undefined,
    gclid: url.searchParams.get("gclid") || undefined,
    gbraid: url.searchParams.get("gbraid") || undefined,
    wbraid: url.searchParams.get("wbraid") || undefined,
    fbclid: url.searchParams.get("fbclid") || undefined,
    fbp: url.searchParams.get("fbp") || undefined,
    ttclid: url.searchParams.get("ttclid") || undefined,
    utm_term: url.searchParams.get("utm_term") || undefined,
    utm_content: url.searchParams.get("utm_content") || undefined,
    msclkid: url.searchParams.get("msclkid") || undefined,
    parent_click_id,
    redirect_to: redirectTo || undefined,
    sub1: url.searchParams.get("sub1") || undefined,
    sub2: url.searchParams.get("sub2") || undefined,
    sub3: url.searchParams.get("sub3") || undefined,
  };

  const headers = {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": request.headers.get("user-agent") || "ClickoraEdgeWorker/1",
    "x-forwarded-for": visitorIp,
    "cf-connecting-ip": visitorIp,
  };
  const country = String(request.headers.get("cf-ipcountry") || "").trim();
  if (country) headers["cf-ipcountry"] = country;
  if (env.TRACK_EDGE_SHARED_SECRET) {
    headers["x-clickora-edge-secret"] = env.TRACK_EDGE_SHARED_SECRET;
  }

  try {
    const res = await fetch(`${base}/track/click`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.click_id === "string" ? data.click_id : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/\/(?:api\/)?track\/r\/([0-9a-f-]{36})/i);
    if (!m) {
      return json({ error: "Use /api/track/r/:presellId" }, 404);
    }
    const presellId = m[1];

    if (!originApiBase(env)) {
      return json({ error: "ORIGIN_API_BASE em falta" }, 500);
    }

    const dest = await fetchDest(env, presellId);
    if (!dest?.destination) {
      return originTrackRedirect(env, presellId, url.search);
    }

    if (cloakGeoDenied(dest, request)) {
      return originTrackRedirect(env, presellId, url.search);
    }

    const clickId = await createClick(env, presellId, request, url, dest.destination);
    if (!clickId) {
      // Guard / IP em falta / 5xx: nunca abrir oferta sem atribuição.
      return originTrackRedirect(env, presellId, url.search);
    }

    const platform =
      url.searchParams.get("network") || url.searchParams.get("platform") || dest.network || null;
    let target = forwardAdQuery(dest.destination, url.searchParams);
    target = appendClickId(target, clickId, platform);
    return Response.redirect(target, 302);
  },
};
