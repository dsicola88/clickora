/**
 * E2E local (working tree): fábrica SP — import mwebkivo → review → IA/determinístico → 3 variantes.
 *
 *   npx tsx scripts/e2e-local-factory-mwebkivo.ts
 *
 * API default: http://127.0.0.1:3001/api
 */
import assert from "node:assert/strict";

const API = (process.env.E2E_API_BASE || "http://127.0.0.1:3001/api").replace(/\/$/, "");
const FE = (process.env.E2E_FE_BASE || "http://127.0.0.1:8080").replace(/\/$/, "");
const OFFER = "https://mwebkivo.com/8389/5494/7/";
const STAMP = Date.now();

type Json = Record<string, unknown>;
type Row = { id: string; ok: boolean; detail: string };
const rows: Row[] = [];

function rec(id: string, ok: boolean, detail: string) {
  rows.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

async function req(
  path: string,
  init: RequestInit & { token?: string; timeoutMs?: number } = {},
): Promise<{ status: number; json: Json; text: string }> {
  const { timeoutMs = 180_000, token, ...rest } = init;
  const headers: Record<string, string> = { ...(rest.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (rest.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const r = await fetch(`${API}${path}`, {
    ...rest,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await r.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { _raw: text.slice(0, 500) };
  }
  return { status: r.status, json, text };
}

async function waitHealth(ms = 90_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(8_000) });
      if (r.ok) return;
    } catch {
      /* */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`health timeout ${API}`);
}

async function main() {
  console.log(`\n=== E2E local factory (mwebkivo) ===\nAPI=${API}\nFE=${FE}\nOFFER=${OFFER}\n`);
  await waitHealth();
  rec("health", true, "API ok");

  const password = "E2eFactory!Pass99";
  let email = `e2e-factory-${STAMP}@clickora.local`;
  let token = "";
  let lastAuth = "";
  for (let attempt = 1; attempt <= 5; attempt++) {
    email = `e2e-factory-${STAMP}-${attempt}@clickora.local`;
    const reg = await req("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        full_name: "E2E Factory Local",
        accept_policies: true,
      }),
    });
    token = String(reg.json.token || "");
    lastAuth = `register#${attempt}→${reg.status} ${String(reg.json.error || "").slice(0, 160)}`;
    if (token) break;
    await new Promise((r) => setTimeout(r, 1200 * attempt));
  }
  rec("auth", Boolean(token), lastAuth);
  assert.ok(token, "token");

  const quota = await req("/presells/ai/quota", { token });
  rec(
    "ai_quota_route",
    quota.status === 200,
    `GET ai-quota → ${quota.status} · ${JSON.stringify({
      limit: quota.json.limit,
      remaining: quota.json.remaining,
      openai: quota.json.openai_configured,
    })}`,
  );

  console.log("\n— import-from-url (pode demorar) —");
  const imp = await req("/presells/import-from-url", {
    method: "POST",
    token,
    timeoutMs: 180_000,
    body: JSON.stringify({
      product_url: OFFER,
      affiliate_link: OFFER,
      language: "pt-BR",
      generation_niche: "black",
    }),
  });
  const productName = String(imp.json.product_name || imp.json.title || "Oferta");
  const salesLen = String(imp.json.sales_text || "").length;
  const images = Array.isArray(imp.json.images) ? (imp.json.images as string[]) : [];
  rec(
    "import_mwebkivo",
    imp.status === 200 && salesLen >= 40,
    `→ ${imp.status} · product=${productName} · sales=${salesLen} · images=${images.length} · err=${String(imp.json.error || "")}`,
  );
  assert.equal(imp.status, 200, `import failed: ${imp.text.slice(0, 300)}`);

  const settings = {
    businessName: "E2E Factory Operator",
    contactEmail: email,
    showAffiliateTrustFooter: false,
    privacyPolicyUrl: "/privacidade",
    cookiePolicyUrl: "/privacidade",
    affiliateDisclosure:
      "Divulgação: podemos receber comissão por links de afiliado, sem custo extra para si.",
  };

  const created = await req("/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `E2E Factory ${productName}`.slice(0, 80),
      slug: `e2e-factory-${STAMP.toString(36)}`,
      type: "review",
      category: "sem",
      language: "pt-BR",
      status: "published",
      content: {
        title: String(imp.json.title || productName),
        productName,
        subtitle: String(imp.json.subtitle || "Análise independente"),
        salesText: String(imp.json.sales_text || ""),
        sales_text: String(imp.json.sales_text || ""),
        ctaText: String(imp.json.cta_text || "Continuar para a página oficial da oferta"),
        affiliateLink: OFFER,
        generationNiche: "black",
        policyUrls: imp.json.policy_urls ?? {},
        importMode: imp.json.import_mode,
        ...(typeof imp.json.import_mirror_src_doc === "string" &&
        String(imp.json.import_mirror_src_doc).length > 0
          ? { importMirrorSrcDoc: imp.json.import_mirror_src_doc }
          : {}),
        productImages: images.slice(0, 6),
      },
      settings,
    }),
  });
  const pageId = String(created.json.id || "");
  rec("create_review", (created.status === 201 || created.status === 200) && Boolean(pageId), `→ ${created.status} id=${pageId}`);
  assert.ok(pageId);

  const gen = await req(`/presells/${pageId}/generate-review-copy`, {
    method: "POST",
    token,
    body: JSON.stringify({ force: true, angle: "review", deterministic_only: false }),
  });
  const genCopy = (gen.json.copy && typeof gen.json.copy === "object" ? gen.json.copy : gen.json) as Json;
  const genText = String(genCopy.sales_text || genCopy.salesText || "");
  const genWords = genText.trim().split(/\s+/).filter(Boolean).length;
  const genSource = String(genCopy.source || gen.json.source || "");
  const article = (genCopy.article && typeof genCopy.article === "object" ? genCopy.article : null) as Json | null;
  const pillars = Array.isArray(article?.pillars) ? article!.pillars.length : 0;
  rec(
    "generate_review_copy",
    gen.status === 200 && genWords >= 80 && pillars >= 3,
    `→ ${gen.status} · words=${genWords} · pillars=${pillars} · source=${genSource} · applied=${String(gen.json.applied)} · err=${String(gen.json.error || "")}`,
  );

  // Confirmar que o conteúdo gravado tem campos editoriais (visíveis no portal black).
  const after = await req(`/presells/${pageId}`, { token });
  const stored = (after.json.content || {}) as Json;
  const hasStructured =
    typeof stored.articleHeadline === "string" &&
    String(stored.articleHeadline).length > 10 &&
    Array.isArray(stored.articlePillars) &&
    (stored.articlePillars as unknown[]).length >= 2;
  rec(
    "structured_article_persisted",
    after.status === 200 && hasStructured,
    `headline=${String(stored.articleHeadline || "").slice(0, 60)} · pillars=${Array.isArray(stored.articlePillars) ? (stored.articlePillars as unknown[]).length : 0}`,
  );

  const pack = await req(`/presells/${pageId}/spawn-variant-pack`, {
    method: "POST",
    token,
    timeoutMs: 180_000,
    body: JSON.stringify({ create_rotator: true, deterministic_only: false }),
  });
  const pages = (pack.json.pages || {}) as Record<
    string,
    { id?: string; slug?: string; type?: string; status?: string }
  >;
  const landingId = String(pages.landing?.id || "");
  const reviewId = String(pages.review?.id || "");
  const advId = String(pages.advertorial?.id || "");
  const statuses = [pages.landing?.status, pages.review?.status, pages.advertorial?.status];
  const allPublished = statuses.every((s) => s === "published");
  rec(
    "spawn_variant_pack",
    pack.status === 200 && Boolean(landingId && reviewId && advId) && allPublished,
    `→ ${pack.status} · L=${pages.landing?.slug || "?"}(${pages.landing?.status}) R=${pages.review?.slug || "?"}(${pages.review?.status}) A=${pages.advertorial?.slug || "?"}(${pages.advertorial?.status}) · err=${String(pack.json.error || "")}`,
  );

  // Rotador 33/33/34 (como o wizard/painel) — URL única Ads.
  const feBase = FE.replace(/\/$/, "");
  const armUrl = (id: string) => `${feBase}/p/${id}`;
  const rot = await req("/traffic-rotators", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: `E2E pack ${STAMP}`.slice(0, 120),
      slug: `e2e-pack-${STAMP.toString(36)}`,
      mode: "weighted",
      context_presell_id: pageId,
      is_active: true,
      sticky_session: true,
      arms: [
        { destination_url: armUrl(landingId), label: "Landing", order_index: 0, weight: 33 },
        { destination_url: armUrl(reviewId), label: "Review", order_index: 1, weight: 33 },
        { destination_url: armUrl(advId), label: "Advertorial", order_index: 2, weight: 34 },
      ],
    }),
  });
  const rotatorClick = String(rot.json.public_click_url || "");
  rec(
    "rotator_33_33_34",
    rot.status === 201 || rot.status === 200 ? Boolean(rotatorClick) : false,
    `→ ${rot.status} · url=${rotatorClick.slice(0, 80) || String(rot.json.error || "").slice(0, 120)}`,
  );

  // Ângulos distintos nas 3 páginas
  const getContent = async (id: string) => {
    const r = await req(`/presells/${id}`, { token });
    return (r.json.content || {}) as Json;
  };
  const cL = await getContent(landingId);
  const cR = await getContent(reviewId);
  const cA = await getContent(advId);
  const kickers = [cL.articleKicker, cR.articleKicker, cA.articleKicker].map(String);
  const distinct =
    new Set(kickers.filter(Boolean)).size >= 2 &&
    String(cL.articleHeadline || "") !== String(cA.articleHeadline || "");
  rec(
    "angles_distinct",
    distinct,
    `kickers=${kickers.join(" | ")}`,
  );

  const compliance = await req(`/presells/${pageId}/compliance/audit`, {
    method: "POST",
    token,
  });
  const gate = String(compliance.json.gate || compliance.json.compliance_gate || compliance.json.latest_audit && (compliance.json.latest_audit as Json).gate || "");
  const score = compliance.json.ads_page_score;
  rec(
    "compliance_audit",
    compliance.status === 200 || compliance.status === 201,
    `→ ${compliance.status} · gate=${gate || "?"} · ads_score=${score ?? "?"} · err=${String(compliance.json.error || "")}`,
  );

  const pub = await req(`/public/presells/id/${pageId}`);
  const pubTitle = String(pub.json.title || pub.json.name || "");
  const pubContent = JSON.stringify(pub.json).toLowerCase();
  const hasDisclosure =
    pubContent.includes("comiss") ||
    pubContent.includes("afiliad") ||
    pubContent.includes("affiliate");
  const hasOffer =
    pubContent.includes("mwebkivo") ||
    pubContent.includes(OFFER.toLowerCase()) ||
    pubContent.includes("track");
  rec(
    "public_page",
    pub.status === 200 && hasOffer,
    `→ ${pub.status} · title=${pubTitle.slice(0, 60)} · disclosure≈${hasDisclosure} · offer_track≈${hasOffer}`,
  );

  const ids = [...new Set([pageId, landingId, reviewId, advId].filter(Boolean))];
  const rotatorDbId = String(rot.json.id || "");
  if (process.env.E2E_KEEP_PAGES === "1") {
    rec("cleanup", true, `KEEP ${ids.length} page(s) · base=${pageId} · rotator=${rotatorDbId || "n/a"}`);
    console.log(`PUBLIC ${FE}/p/${pageId}`);
    if (rotatorClick) console.log(`ROTATOR ${rotatorClick}`);
    console.log(`TOKEN_HINT email=${email}`);
  } else {
    if (rotatorDbId) {
      await req(`/traffic-rotators/${rotatorDbId}`, { method: "DELETE", token }).catch(() => null);
    }
    for (const id of ids) {
      await req(`/presells/${id}`, { method: "DELETE", token }).catch(() => null);
    }
    rec("cleanup", true, `deleted ${ids.length} page(s) + rotator`);
  }

  const failed = rows.filter((r) => !r.ok);
  console.log(`\n=== Resumo: ${rows.length - failed.length}/${rows.length} PASS ===`);
  console.log(`FE wizard: ${FE}/presells/nova`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
