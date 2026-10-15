/**
 * Auditoria E2E do fluxo presell: import Black/White → conta → rascunho → editor (builder) → publicar → página pública.
 *
 * Uso (API local + Postgres de teste):
 *   DATABASE_URL=postgresql://clickora:clickora@127.0.0.1:5435/clickora_e2e \
 *   E2E_API_BASE=http://127.0.0.1:3001/api \
 *   npx tsx scripts/e2e-presell-flow-audit.ts
 */
import assert from "node:assert/strict";
import { createSection, createWidget, id } from "../../frontend/src/page-builder/factory";
import { extractPresellSignals } from "../src/compliance/extractPresellSignals";
import { canPublishForAds, evaluateCompliance } from "../src/compliance/evaluate";
import type { DestinationProbeResult } from "../src/compliance/types";

const API = (process.env.E2E_API_BASE || "http://127.0.0.1:3001/api").replace(/\/$/, "");
const OFFER = "https://en.wikipedia.org/wiki/Tea";
const HEADLINE = "E2E Tea — revisão e editor";

const destOk: DestinationProbeResult = {
  attempted: true,
  ok: true,
  https: true,
  statusCode: 200,
  finalUrl: OFFER,
  redirectCount: 0,
  redirectCycle: false,
  openRedirectSuspect: false,
  domainChanged: false,
  initialHost: "en.wikipedia.org",
  finalHost: "en.wikipedia.org",
  crawlerBlocked: false,
  hops: [OFFER],
};

type Json = Record<string, unknown>;

async function req(
  path: string,
  init: RequestInit & { token?: string; timeoutMs?: number } = {},
): Promise<{ status: number; json: Json }> {
  const { timeoutMs = 60_000, token, ...rest } = init;
  const headers: Record<string, string> = {
    ...(rest.headers as Record<string, string>),
  };
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
    json = { _raw: text.slice(0, 400) };
  }
  return { status: r.status, json };
}

function buildBuilderDocument(): Json {
  const article = [
    "Esta página é um conteúdo informativo independente sobre Tea.",
    "Não somos o fabricante, não processamos pagamentos e não substituímos a ficha técnica.",
    "O que deve confirmar no site oficial: identidade do vendedor, preço, envio e garantia.",
    "Podemos receber comissão por indicação, sem custo extra para o leitor.",
    "Use o botão para abrir a página oficial da oferta e verificar todas as condições antes de comprar.",
    "Confirme contacto, prazo de entrega e política de devolução no destino.",
  ].join(" ");
  const section = createSection(1);
  const heading = createWidget("heading");
  heading.content = { ...heading.content, text: HEADLINE, tag: "h1" };
  const text = createWidget("text");
  text.content = { ...text.content, html: `<p>${article}</p>` };
  const button = createWidget("button");
  button.content = { ...button.content, text: "Continuar para a página oficial da oferta", href: OFFER, target: "_self" };
  const image = createWidget("image");
  image.content = {
    ...image.content,
    src: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg",
    alt: "Tea",
  };
  section.columns[0].widgets = [image, heading, text, button, createWidget("cookieBanner")];
  return {
    id: id("page_"),
    name: "E2E Tea",
    sections: [section],
    settings: { background: "#ffffff", maxContentWidth: 860 },
    updatedAt: Date.now(),
  };
}

function log(step: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${step} — ${detail}`);
  if (!ok) process.exitCode = 1;
}

async function auditImportNiche(token: string, niche: "black" | "white"): Promise<Json> {
  const imp = await req("/presells/import-from-url", {
    method: "POST",
    token,
    timeoutMs: 180_000,
    body: JSON.stringify({
      product_url: OFFER,
      affiliate_link: OFFER,
      language: "en",
      generation_niche: niche,
    }),
  });
  const generation = String(imp.json.generation_niche || "");
  const salesLen = String(imp.json.sales_text || "").length;
  const mirrorLen = String(imp.json.import_mirror_src_doc || "").length;
  const publishable = imp.json.publishable === true;
  const ok =
    imp.status === 200 &&
    generation === niche &&
    publishable &&
    salesLen >= 80 &&
    mirrorLen >= 800;
  log(
    `import_${niche}`,
    ok,
    `POST import-from-url → ${imp.status} · niche=${generation} · sales=${salesLen} · mirror=${mirrorLen} · publishable=${publishable}`,
  );
  return imp.json;
}

async function main() {
  console.log(`\n=== Presell flow E2E audit ===\nAPI=${API}\n`);

  const health = await req("/health");
  log("health", health.status === 200, `GET /health → ${health.status}`);
  if (health.status !== 200) {
    console.error("API indisponível. Arranque o backend com DATABASE_URL de teste.");
    process.exit(1);
  }

  const email = `e2e-flow-${Date.now()}@clickora.test`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "E2eTestPass-9chars",
      full_name: "E2E Flow",
      accept_policies: true,
    }),
  });
  const token = String(reg.json.token || "");
  log("register", reg.status === 201 && Boolean(token), `POST /auth/register → ${reg.status}`);
  assert.ok(token, "token ausente");

  const importBlack = await auditImportNiche(token, "black");
  const importWhite = await auditImportNiche(token, "white");

  const settings = {
    businessName: "E2E Flow Operator",
    contactEmail: email,
    privacyPolicyUrl: "/privacidade",
    cookiePolicyUrl: "/privacidade",
    affiliateDisclosure:
      "Divulgação: podemos receber comissão por links de afiliado, sem custo extra para si.",
  };

  const salesText =
    "Análise independente sobre Tea com critérios de decisão e transparência. " +
    "Não prometemos resultados médicos. Confirme preço e garantia no site oficial. " +
    "Podemos receber comissão por indicação. Compare alternativas antes de comprar.";

  const blackImages = Array.isArray(importBlack.images) ? (importBlack.images as string[]) : [];
  const created = await req("/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: "E2E Tea",
      slug: `e2e-tea-${Date.now().toString(36)}`,
      type: "cookies",
      category: "sem",
      language: "pt-BR",
      status: "draft",
      content: {
        title: String(importBlack.title || "Tea"),
        productName: String(importBlack.product_name || "Tea"),
        subtitle: String(importBlack.subtitle || "Conteúdo informativo independente"),
        salesText: String(importBlack.sales_text || salesText),
        ctaText: String(importBlack.cta_text || "Continuar para a página oficial da oferta"),
        affiliateLink: OFFER,
        generationNiche: "black",
        policyUrls: importBlack.policy_urls ?? {},
        importMode: importBlack.import_mode,
        ...(typeof importBlack.import_mirror_src_doc === "string" && importBlack.import_mirror_src_doc.length > 0
          ? { importMirrorSrcDoc: importBlack.import_mirror_src_doc }
          : {}),
        productImages: blackImages.length
          ? blackImages.slice(0, 6)
          : ["https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg"],
      },
      settings,
    }),
  });
  const pageId = String(created.json.id || "");
  log("wizard_create", created.status === 201 && Boolean(pageId), `POST /presells → ${created.status}`);
  assert.ok(pageId, "id da presell ausente");

  const pageDocument = buildBuilderDocument();
  const editorSave = await req(`/presells/${pageId}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      type: "builder",
      language: "pt-BR",
      content: {
        pageDocument,
        affiliateLink: OFFER,
      },
      settings,
    }),
  });
  log(
    "editor_save",
    editorSave.status === 200 && editorSave.json.type === "builder",
    `PUT /presells/:id (builder) → ${editorSave.status}`,
  );

  const signals = extractPresellSignals({
    title: "E2E Tea",
    type: "builder",
    language: "pt-BR",
    content: { pageDocument, affiliateLink: OFFER },
    settings,
  });
  const compliance = evaluateCompliance({ signals, destination: destOk });
  const gateOk = canPublishForAds(compliance.gate);
  log(
    "compliance_pre_publish",
    gateOk,
    `gate=${compliance.gate} (OC-001=${compliance.results.find((r) => r.ruleId === "OC-001")?.status})`,
  );

  const pub = await req(`/presells/${pageId}/status`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status: "published" }),
  });
  const published = pub.status === 200 && pub.json.status === "published";
  log(
    "publish",
    published,
    published
      ? "PATCH status=published OK"
      : `PATCH → ${pub.status} ${String(pub.json.error || pub.json.code || "")}`,
  );

  const pubGet = await req(`/public/presells/id/${pageId}`);
  const publicOk = pubGet.status === 200 && pubGet.json.status === "published";
  log("public_api", publicOk, `GET /public/presells/id/:id → ${pubGet.status}`);

  const blob = JSON.stringify(pubGet.json.content || {});
  const hasHeadline = blob.includes(HEADLINE);
  log("public_content", hasHeadline, hasHeadline ? "headline do editor visível na API pública" : "headline em falta");

  const whiteSlug = `e2e-white-${Date.now().toString(36)}`;
  const whiteImages = Array.isArray(importWhite.images) ? (importWhite.images as string[]) : [];
  const whiteCreate = await req("/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: "E2E Tea White",
      slug: whiteSlug,
      type: "tsl",
      category: "sem",
      language: "en",
      status: "published",
      content: {
        title: String(importWhite.title || "Tea"),
        productName: String(importWhite.product_name || "Tea"),
        subtitle: String(importWhite.subtitle || ""),
        salesText: String(importWhite.sales_text || ""),
        ctaText: String(importWhite.cta_text || "Continue"),
        affiliateLink: OFFER,
        generationNiche: "white",
        policyUrls: importWhite.policy_urls ?? {},
        importMode: importWhite.import_mode,
        ...(typeof importWhite.import_mirror_src_doc === "string" && importWhite.import_mirror_src_doc.length > 0
          ? { importMirrorSrcDoc: importWhite.import_mirror_src_doc }
          : {}),
        productImages: whiteImages.slice(0, 6),
      },
      settings,
    }),
  });
  const whiteId = String(whiteCreate.json.id || "");
  log(
    "white_publish_create",
    whiteCreate.status === 201 && Boolean(whiteId),
    `POST presell white+import → ${whiteCreate.status}`,
  );

  const whitePub = whiteId ? await req(`/public/presells/id/${whiteId}`) : { status: 0, json: {} };
  const whiteContent = JSON.stringify(whitePub.json.content || {});
  const whiteNicheOk =
    whitePub.status === 200 &&
    (whiteContent.includes('"generationNiche":"white"') || whiteContent.includes('"generation_niche":"white"'));
  log(
    "white_public_niche",
    whiteNicheOk,
    whiteNicheOk ? "generationNiche=white na API pública" : `GET público → ${whitePub.status}`,
  );

  console.log("\n--- resumo ---");
  if (process.exitCode) {
    console.log("Falhou — corrija antes de considerar o fluxo 100% operacional.\n");
    process.exit(1);
  }
  console.log(`Fluxo OK · presell ${pageId} · email ${email}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
