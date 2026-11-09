/**
 * Cloudflare Worker — redirect edge para ofertas Clickora.
 * 1) Destino cacheado no origin
 * 2) Regista clique sync → click_id
 * 3) 302 com clickora_click_id / subids na oferta
 */
const DEST_TTL_MS = 60_000;
const memory = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function edgeHeaders(env) {
  const headers = { accept: "application/json", "content-type": "application/json" };
  if (env.TRACK_EDGE_SHARED_SECRET) {
    headers["x-clickora-edge-secret"] = env.TRACK_EDGE_SHARED_SECRET;
  }
  return headers;
}

async function fetchDest(env, presellId) {
  const hit = memory.get(presellId);
  if (hit && Date.now() < hit.exp) return hit.value;

  const base = String(env.ORIGIN_API_BASE || "").replace(/\/+$/, "");
  if (!base) return null;
  const res = await fetch(`${base}/track/edge/dest/${encodeURIComponent(presellId)}`, {
    headers: edgeHeaders(env),
  });
  if (!res.ok) return null;
  const body = await res.json();
  if (!body?.destination || body.status !== "published") return null;
  memory.set(presellId, { exp: Date.now() + DEST_TTL_MS, value: body });
  return body;
}

function forwardQuery(url) {
  const out = new URLSearchParams();
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "to") continue;
    out.append(k, v);
  }
  return out;
}

function appendParams(dest, params) {
  try {
    const u = new URL(dest);
    for (const [k, v] of params.entries()) {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return dest;
  }
}

/** Espelha appendClickIdToAffiliateUrl (núcleo): clickora_click_id + subid*. */
function appendClickId(destUrl, clickId) {
  try {
    const u = new URL(destUrl);
    u.searchParams.set("clickora_click_id", clickId);
    for (const key of ["subid", "subid1", "subid2", "sid1", "clickid"]) {
      const existing = u.searchParams.get(key);
      if (!existing || !/^[0-9a-f-]{36}$/i.test(existing)) {
        u.searchParams.set(key, clickId);
      }
    }
    return u.toString();
  } catch {
    const sep = destUrl.includes("?") ? "&" : "?";
    return `${destUrl}${sep}clickora_click_id=${encodeURIComponent(clickId)}&subid=${encodeURIComponent(clickId)}`;
  }
}

async function createClick(env, presellId, request, url) {
  const base = String(env.ORIGIN_API_BASE || "").replace(/\/+$/, "");
  if (!base) return null;
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
    ttclid: url.searchParams.get("ttclid") || undefined,
    utm_term: url.searchParams.get("utm_term") || undefined,
    utm_content: url.searchParams.get("utm_content") || undefined,
    msclkid: url.searchParams.get("msclkid") || undefined,
    parent_click_id: url.searchParams.get("clickora_click_id") || url.searchParams.get("parent_click_id") || undefined,
  };
  try {
    const res = await fetch(`${base}/track/click`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": request.headers.get("user-agent") || "ClickoraEdgeWorker/1",
        "x-forwarded-for": request.headers.get("cf-connecting-ip") || "",
      },
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
    const dest = await fetchDest(env, presellId);
    if (!dest?.destination) {
      const base = String(env.ORIGIN_API_BASE || "").replace(/\/+$/, "");
      if (!base) return json({ error: "ORIGIN_API_BASE em falta" }, 500);
      return Response.redirect(`${base}/track/r/${encodeURIComponent(presellId)}${url.search}`, 302);
    }

    let target = appendParams(dest.destination, forwardQuery(url));
    const clickId = await createClick(env, presellId, request, url);
    if (clickId) {
      target = appendClickId(target, clickId);
    }
    return Response.redirect(target, 302);
  },
};
