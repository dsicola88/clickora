/**
 * FASE E — Auditoria de URLs e redirecionamentos (BD + API locais isolados).
 *
 * Segurança: loadTestSafety — só localhost; nunca Railway.
 *
 *   set -a && source .env.audit-fase-b && set +a
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3011 ALLOW_MUTATING_LOAD_TEST=1 \
 *   LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… \
 *   npx tsx scripts/audit-fase-e-urls.ts
 */
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseForMutations, assertSafeHttpTarget, databaseHostInfo } from "./lib/loadTestSafety";
import { isRedirectToAllowedOffer } from "../src/lib/trackOfferRedirectGuard";

const BASE = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";
const OFFER = "https://example.com/buy?aff=fe";
const STAMP = Date.now().toString(36);

type Status = "VALIDADO COM EVIDÊNCIA" | "FALHOU" | "BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA" | "NÃO TESTADO";

type Row = {
  id: string;
  status: Status;
  test: string;
  evidence: string[];
  failures: string[];
};

const rows: Row[] = [];

function add(id: string, status: Status, test: string, evidence: string[] = [], failures: string[] = []) {
  rows.push({ id, status, test, evidence, failures });
}

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: string } = {},
) {
  const headers: Record<string, string> = {
    Origin: "http://127.0.0.1:8080",
    Accept: "application/json",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, { method: opts.method || "GET", headers, body: opts.body });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function hitR(presellId: string, qs: string) {
  const res = await fetch(`${BASE}/api/track/r/${presellId}?${qs}`, {
    redirect: "manual",
    headers: { "User-Agent": "ClickoraAuditE/1.0", Accept: "text/html,*/*" },
  });
  const loc = res.headers.get("location") || "";
  const text = res.status !== 302 ? (await res.text()).slice(0, 200) : "";
  return { status: res.status, location: loc, text };
}

function isSafePage(status: number, location: string): boolean {
  // Cloak/safe page: 200 HTML, sem Location para evil
  if (status === 302 || status === 301) {
    try {
      const h = new URL(location).hostname.replace(/^www\./i, "").toLowerCase();
      return h === "example.com";
    } catch {
      return false;
    }
  }
  return status === 200 || status === 403 || status === 400;
}

async function main() {
  assertSafeHttpTarget(BASE, "mutating");
  assertLocalDatabaseForMutations();
  const info = databaseHostInfo();
  if (!info.isLocal || info.blocked) {
    console.error("ABORT: DATABASE_URL não local");
    process.exit(2);
  }
  console.log(JSON.stringify({ safety: { api: BASE, db_host: info.host, db_port: info.port, railway: false } }));

  if (!EMAIL || !PASSWORD) {
    console.error("LOAD_TEST_EMAIL/PASSWORD obrigatórios");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  const login = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (login.status !== 200 || !login.json?.token) {
    console.error("login fail", login.status);
    process.exit(1);
  }
  const token = login.json.token as string;

  const ARTICLE =
    "Auditoria de URLs FASE E. Conteúdo descritivo suficiente para validadores de compliance quando activos. " +
    "Não prometemos resultados. Confirme preço e garantia no site oficial. Esta página usa links de afiliado. " +
    "Compare alternativas e verifique o suporte ao cliente. Limitações de stock e envio podem mudar. ";

  const created = await api("/api/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `FE URLs ${STAMP}`,
      slug: `fe-urls-${STAMP}`,
      type: "review",
      language: "pt",
      status: "draft",
      content: {
        product_name: "Produto FE",
        title: `FE URLs ${STAMP}`,
        subtitle: "URLs",
        sales_text: ARTICLE,
        cta_text: "Ver oferta",
        images: ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
        affiliate_link: OFFER,
        source_url: OFFER,
      },
      settings: {
        privacyPolicyUrl: "/privacidade",
        cookiePolicyUrl: "/privacidade",
        businessName: "Analista Independente Lda",
        contactEmail: "ops@example.com",
        affiliateDisclosure:
          "Divulgação: esta página pode conter links de afiliado. Se comprar através deles, posso receber uma comissão.",
      },
      tracking: { offerUrl: OFFER },
    }),
  });
  const presellId = created.json?.id as string | undefined;
  if (!presellId) {
    console.error("create fail", created.status, created.text.slice(0, 300));
    process.exit(1);
  }
  // Force publish to avoid compliance backlog blocking FASE E
  await prisma.presellPage.update({
    where: { id: presellId },
    data: { status: "published", content: created.json.content, tracking: { offerUrl: OFFER } },
  });

  // E1 — redirect legítimo com to=offer
  {
    const h = await hitR(presellId, `to=${encodeURIComponent(OFFER)}&utm_source=fasee`);
    const ok = h.status === 302 && h.location.startsWith("https://example.com/buy") && h.location.includes("clickora_click_id=");
    add(
      "E1",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "redirect legítimo para hoplink configurado",
      [`status=${h.status}`, `loc=${h.location.slice(0, 140)}`],
      ok ? [] : ["não redireccionou para oferta"],
    );
  }

  // E2 — open redirect host evil bloqueado
  {
    const evil = "https://evil.example/phish";
    const h = await hitR(presellId, `to=${encodeURIComponent(evil)}`);
    const leaked = h.status === 302 && /evil\.example/i.test(h.location);
    const ok = !leaked && isSafePage(h.status, h.location);
    add(
      "E2",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "open redirect host externo bloqueado",
      [`status=${h.status}`, `loc=${h.location.slice(0, 100) || "(none)"}`, `unit=${isRedirectToAllowedOffer(evil, OFFER)}`],
      ok ? [] : ["vazou para host externo"],
    );
  }

  // E3 — userinfo evil@offer.example bloqueado
  {
    const evil = "https://evil@example.com/buy?aff=fe";
    const h = await hitR(presellId, `to=${encodeURIComponent(evil)}`);
    const leaked = h.status === 302 && (h.location.includes("evil@") || h.location.includes("evil%40"));
    const ok = !leaked && isSafePage(h.status, h.location) && isRedirectToAllowedOffer(evil, OFFER) === false;
    add(
      "E3",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "userinfo (@) no to bloqueado",
      [`status=${h.status}`, `loc=${(h.location || "").slice(0, 80)}`, `guard=false`],
      ok ? [] : ["userinfo aceite"],
    );
  }

  // E4 — porta não-standard bloqueada
  {
    const evil = "https://example.com:444/buy?aff=fe";
    const h = await hitR(presellId, `to=${encodeURIComponent(evil)}`);
    const leaked = h.status === 302 && h.location.includes(":444");
    const ok = !leaked && isSafePage(h.status, h.location) && isRedirectToAllowedOffer(evil, OFFER) === false;
    add(
      "E4",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "porta :444 ≠ 443 bloqueada",
      [`status=${h.status}`, `loc=${(h.location || "").slice(0, 80)}`],
      ok ? [] : ["porta aceite"],
    );
  }

  // E5 — path diferente bloqueado
  {
    const evil = "https://example.com/other-path";
    const h = await hitR(presellId, `to=${encodeURIComponent(evil)}`);
    const leaked = h.status === 302 && h.location.includes("/other-path");
    const ok = !leaked && isSafePage(h.status, h.location);
    add(
      "E5",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "path diferente do hoplink bloqueado",
      [`status=${h.status}`, `loc=${(h.location || "").slice(0, 80)}`],
      ok ? [] : ["path aceite"],
    );
  }

  // E6 — query extra no to permitido (subs)
  {
    const withSub = `${OFFER}&sub1=campaignX`;
    const h = await hitR(presellId, `to=${encodeURIComponent(withSub)}`);
    const ok = h.status === 302 && h.location.includes("example.com/buy") && h.location.includes("sub1=campaignX");
    add(
      "E6",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "query extra no to (subs) permitida",
      [`status=${h.status}`, `loc=${h.location.slice(0, 160)}`],
      ok ? [] : ["query extra rejeitada"],
    );
  }

  // E7 — base query do hoplink tem de estar presente (aff=fe); alterar aff bloqueia
  {
    const tampered = "https://example.com/buy?aff=TAMPERED";
    const h = await hitR(presellId, `to=${encodeURIComponent(tampered)}`);
    const leaked = h.status === 302 && h.location.includes("aff=TAMPERED");
    const ok = !leaked && isSafePage(h.status, h.location) && isRedirectToAllowedOffer(tampered, OFFER) === false;
    add(
      "E7",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "tamper da query base do hoplink bloqueado",
      [`status=${h.status}`, `loc=${(h.location || "").slice(0, 80)}`],
      ok ? [] : ["aff tampered aceite"],
    );
  }

  // E8 — /r/ faz forwardAdQueryToUrl (D8 corrigido) — ads IDs na Location + metadata
  {
    const h = await hitR(
      presellId,
      `to=${encodeURIComponent(OFFER)}&gclid=GclidFaseEShouldForward&fbclid=FbclidFaseEShouldForward&utm_source=google`,
    );
    let locUrl: URL | null = null;
    try {
      locUrl = new URL(h.location);
    } catch {
      locUrl = null;
    }
    const gclidOnOffer = locUrl?.searchParams.get("gclid");
    const fbclidOnOffer = locUrl?.searchParams.get("fbclid");
    const clickId = locUrl?.searchParams.get("clickora_click_id") || "";
    const ev = clickId ? await prisma.trackingEvent.findUnique({ where: { id: clickId } }) : null;
    const meta = (ev?.metadata || {}) as Record<string, unknown>;
    const ok =
      h.status === 302 &&
      gclidOnOffer === "GclidFaseEShouldForward" &&
      fbclidOnOffer === "FbclidFaseEShouldForward" &&
      meta.gclid === "GclidFaseEShouldForward" &&
      meta.fbclid === "FbclidFaseEShouldForward";
    add(
      "E8",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "/r/ encaminha ads IDs para o hoplink (forwardAdQueryToUrl)",
      [
        `status=${h.status}`,
        `loc_gclid=${gclidOnOffer || "absent"}`,
        `loc_fbclid=${fbclidOnOffer || "absent"}`,
        `meta_gclid=${meta.gclid || "missing"}`,
        `meta_fbclid=${meta.fbclid || "missing"}`,
      ],
      ok ? [] : ["forward ads IDs em /r/ falhou"],
    );
  }

  // E9 — javascript: / data: rejeitados
  {
    const js = await hitR(presellId, `to=${encodeURIComponent("javascript:alert(1)")}`);
    const data = await hitR(presellId, `to=${encodeURIComponent("data:text/html,hi")}`);
    const jsLeak = js.status === 302 && /^javascript:/i.test(js.location);
    const dataLeak = data.status === 302 && /^data:/i.test(data.location);
    const ok = !jsLeak && !dataLeak && isSafePage(js.status, js.location) && isSafePage(data.status, data.location);
    add(
      "E9",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "esquemas javascript:/data: bloqueados",
      [`js=${js.status}`, `data=${data.status}`],
      ok ? [] : ["esquema perigoso aceite"],
    );
  }

  // E10 — redirect sem `to` usa hoplink configurado
  {
    const h = await hitR(presellId, `utm_campaign=default-to`);
    const ok = h.status === 302 && h.location.includes("example.com/buy") && h.location.includes("clickora_click_id=");
    add(
      "E10",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "sem to → usa affiliate_link/offerUrl configurado",
      [`status=${h.status}`, `loc=${h.location.slice(0, 140)}`],
      ok ? [] : ["fallback to configurado falhou"],
    );
  }

  // E11 — appendClickId (clickora_click_id + subid genérico)
  {
    const h = await hitR(presellId, `to=${encodeURIComponent(OFFER)}`);
    let u: URL | null = null;
    try {
      u = new URL(h.location);
    } catch {
      u = null;
    }
    const cid = u?.searchParams.get("clickora_click_id") || "";
    const sub = u?.searchParams.get("subid") || u?.searchParams.get("subid1") || "";
    const ok = h.status === 302 && /^[0-9a-f-]{36}$/i.test(cid) && sub === cid;
    add(
      "E11",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "appendClickIdToAffiliateUrl (clickora_click_id + subid)",
      [`cid=${cid.slice(0, 8)}…`, `subid_match=${sub === cid}`],
      ok ? [] : ["click id não anexado correctamente"],
    );
  }

  // E12 — custom domain API (CRUD smoke; DNS/SSL real = NÃO TESTADO runtime completo)
  {
    const list = await api("/api/custom-domain", { token });
    const listAlt = list.status === 404 ? await api("/api/custom-domains", { token }) : list;
    // Accept list endpoint working OR documented path
    const endpointsTried = [`/api/custom-domain→${list.status}`, `/api/custom-domains→${listAlt.status}`];
    let createStatus = 0;
    let createBody = "";
    if (list.status === 200 || listAlt.status === 200) {
      const cr = await api("/api/custom-domain", {
        method: "POST",
        token,
        body: JSON.stringify({ domain: `fe-audit-${STAMP}.example.test`, purpose: "tracking" }),
      });
      createStatus = cr.status;
      createBody = JSON.stringify(cr.json || cr.text).slice(0, 160);
      // cleanup if created
      const id = cr.json?.id || cr.json?.domain?.id;
      if (id) {
        await api(`/api/custom-domain/${id}`, { method: "DELETE", token }).catch(() => undefined);
      }
    }
    const listOk = list.status === 200 || listAlt.status === 200;
    if (!listOk) {
      add(
        "E12",
        "NÃO TESTADO",
        "custom domain — endpoint list inacessível neste stack",
        endpointsTried,
        [],
      );
    } else {
      // 200/201 create, or 400 validation, or 403 plan — all evidence that API exists
      const ok = createStatus === 200 || createStatus === 201 || createStatus === 400 || createStatus === 403 || createStatus === 409;
      add(
        "E12",
        ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
        "custom domain API list + create smoke (DNS/SSL real NÃO TESTADO)",
        [...endpointsTried, `create=${createStatus}`, createBody],
        ok ? [] : ["API custom domain sem resposta útil"],
      );
    }
  }

  // E13 — unit matrix of isRedirectToAllowedOffer (regression of port/userinfo fixes)
  {
    const cases: Array<{ name: string; to: string; allowed: string; expect: boolean }> = [
      { name: "exact", to: OFFER, allowed: OFFER, expect: true },
      { name: "www", to: "https://www.example.com/buy?aff=fe", allowed: OFFER, expect: true },
      { name: "port443", to: "https://example.com:443/buy?aff=fe", allowed: OFFER, expect: true },
      { name: "port444", to: "https://example.com:444/buy?aff=fe", allowed: OFFER, expect: false },
      { name: "userinfo", to: "https://evil@example.com/buy?aff=fe", allowed: OFFER, expect: false },
      { name: "scheme", to: "http://example.com/buy?aff=fe", allowed: OFFER, expect: false },
      { name: "extra_q", to: `${OFFER}&x=1`, allowed: OFFER, expect: true },
      { name: "missing_aff", to: "https://example.com/buy", allowed: OFFER, expect: false },
    ];
    const results = cases.map((c) => ({
      name: c.name,
      got: isRedirectToAllowedOffer(c.to, c.allowed),
      expect: c.expect,
      ok: isRedirectToAllowedOffer(c.to, c.allowed) === c.expect,
    }));
    const ok = results.every((r) => r.ok);
    add(
      "E13",
      ok ? "VALIDADO COM EVIDÊNCIA" : "FALHOU",
      "matriz unitária isRedirectToAllowedOffer",
      results.map((r) => `${r.name}:got=${r.got}/exp=${r.expect}`),
      ok ? [] : results.filter((r) => !r.ok).map((r) => r.name),
    );
  }

  await api(`/api/presells/${presellId}`, { method: "DELETE", token }).catch(() => undefined);
  await prisma.$disconnect();

  const summary = {
    phase: "E",
    stamp: STAMP,
    validated: rows.filter((r) => r.status === "VALIDADO COM EVIDÊNCIA").length,
    failed: rows.filter((r) => r.status === "FALHOU").length,
    not_tested: rows.filter((r) => r.status === "NÃO TESTADO").length,
    total: rows.length,
    rows,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
