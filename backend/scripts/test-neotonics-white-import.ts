/**
 * Teste real: import white Neotonics (mwebkivo hoplink) → criar presell → validar API pública.
 *
 *   E2E_API_BASE=https://clickora-production.up.railway.app/api \
 *   npx tsx scripts/test-neotonics-white-import.ts
 */
import assert from "node:assert/strict";

const API = (process.env.E2E_API_BASE || "https://clickora-production.up.railway.app/api").replace(
  /\/$/,
  "",
);
const OFFER = "https://mwebkivo.com/8389/5494/7/?";

type Json = Record<string, unknown>;

async function req(
  path: string,
  init: RequestInit & { token?: string; timeoutMs?: number } = {},
): Promise<{ status: number; json: Json }> {
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
  return { status: r.status, json };
}

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

async function main() {
  console.log(`API=${API}\nOFFER=${OFFER}\n`);

  const health = await req("/health", { timeoutMs: 30_000 });
  if (health.status !== 200) fail(`health ${health.status}`);

  const email = `e2e-neotonics-${Date.now()}@clickora.test`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "E2eNeotonics-9chars",
      full_name: "E2E Neotonics",
      accept_policies: true,
    }),
  });
  const token = String(reg.json.token || "");
  if (reg.status !== 201 || !token) fail(`register ${reg.status} ${JSON.stringify(reg.json).slice(0, 200)}`);

  const imp = await req("/presells/import-from-url", {
    method: "POST",
    token,
    timeoutMs: 180_000,
    body: JSON.stringify({
      product_url: OFFER,
      affiliate_link: OFFER,
      language: "en",
      generation_niche: "white",
    }),
  });
  if (imp.status !== 200) fail(`import ${imp.status} ${JSON.stringify(imp.json).slice(0, 400)}`);

  const productName = String(imp.json.product_name || "");
  const mirrorLen = String(imp.json.import_mirror_src_doc || "").length;
  const salesLen = String(imp.json.sales_text || "").length;
  const publishable = imp.json.publishable === true;
  const importMode = String(imp.json.import_mode || "");
  const niche = String(imp.json.generation_niche || "");

  console.log("IMPORT:", {
    productName,
    niche,
    importMode,
    publishable,
    salesLen,
    mirrorLen,
    images: Array.isArray(imp.json.images) ? imp.json.images.length : 0,
    notes: imp.json.import_notes,
  });

  assert.equal(niche, "white");
  assert.equal(publishable, true);
  assert.match(productName.toLowerCase(), /neotonics/);
  assert.ok(salesLen >= 180, `sales_text too short: ${salesLen}`);
  assert.ok(mirrorLen >= 800, `mirror too short (need Chromium in prod): ${mirrorLen}`);

  const slug = `neotonics-white-${Date.now().toString(36)}`;
  const images = Array.isArray(imp.json.images) ? (imp.json.images as string[]) : [];
  const settings: Record<string, string> = {
    privacyPolicyUrl: "/privacidade",
    cookiePolicyUrl: "/privacidade",
    termsUrl: "/termos",
    affiliateDisclosure:
      "Affiliate disclosure: we may earn a commission from links on this page, at no extra cost to you.",
    /** Neotonics não expõe e-mail no HTML; no wizard real use o seu contacto de afiliado. */
    businessName: String(imp.json.source_business_name || productName).trim(),
    contactEmail: String(imp.json.source_contact_email || email).trim(),
  };
  const srcBiz = String(imp.json.source_business_name || "").trim();
  const srcEmail = String(imp.json.source_contact_email || "").trim();

  const create = await req("/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: productName,
      slug,
      type: "cookies",
      language: "en",
      status: "published",
      tracking: { offerUrl: OFFER },
      content: {
        title: productName,
        productName,
        subtitle: imp.json.subtitle,
        salesText: imp.json.sales_text,
        ctaText: imp.json.cta_text,
        affiliateLink: OFFER,
        generationNiche: "white",
        policyUrls: imp.json.policy_urls ?? {},
        importMode,
        storefrontTheme: imp.json.storefront_theme,
        productImages: images.slice(0, 12),
        sourceUrl: imp.json.source_url,
        importMirrorSrcDoc: imp.json.import_mirror_src_doc,
      },
      settings,
    }),
  });
  if (create.status !== 201) fail(`create ${create.status} ${JSON.stringify(create.json).slice(0, 400)}`);

  const presellId = String(create.json.id || "");
  if (!presellId) fail("missing presell id");

  console.log("CREATE:", {
    http: create.status,
    pageStatus: create.json.status,
    compliance_blocked: create.json.compliance_blocked,
    srcBiz,
    srcEmail,
  });

  const pub = await req(`/public/presells/id/${presellId}`, { timeoutMs: 30_000 });
  if (pub.status !== 200 && pub.status !== 403) {
    fail(`public ${pub.status} ${JSON.stringify(pub.json).slice(0, 300)}`);
  }

  const content = (pub.json.content || {}) as Json;
  const pubMirror = String(
    content.importMirrorSrcDoc || pub.json.import_mirror_src_doc || pub.json.mirror_html || "",
  ).length;
  const pubTitle = String(pub.json.title || pub.json.product_name || "");
  console.log("PUBLIC:", { presellId, pubTitle, pubMirrorLen: pubMirror, httpStatus: pub.status });

  assert.equal(create.status, 201);
  assert.ok(mirrorLen >= 800);

  if (create.json.compliance_blocked) {
    const crit = (create.json.compliance as Json)?.critical_issues;
    console.log("COMPLIANCE (auto-publish blocked):", crit);
    fail("create with status published should pass compliance when source identity is imported");
  }

  if (pub.status === 200) {
    assert.match(pubTitle.toLowerCase(), /neotonics/);
    assert.ok(pubMirror >= 800, "public mirror missing");
  } else if (pub.status === 403) {
    console.log("(Public 403 = plano free — espelho OK na API autenticada.)");
  } else {
    fail(`public ${pub.status} ${JSON.stringify(pub.json).slice(0, 200)}`);
  }

  console.log("\nPASS — presell white Neotonics import + publish OK");
  console.log(`URL: https://bestbuyhere.sbs/p/${presellId} (ou domínio verificado da conta)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
