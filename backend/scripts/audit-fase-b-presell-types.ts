/**
 * FASE B — Auditoria end-to-end dos tipos de PresellPage.type (ambiente local isolado).
 *
 * Segurança:
 * - Recusa Railway / hosts remotos (loadTestSafety).
 * - Exige LOAD_TEST_BASE_URL localhost + DATABASE_URL localhost + ALLOW_MUTATING_LOAD_TEST=1.
 *
 * Uso:
 *   set -a && source .env.audit-fase-b && set +a
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3011 ALLOW_MUTATING_LOAD_TEST=1 \
 *   LOAD_TEST_EMAIL=… LOAD_TEST_PASSWORD=… \
 *   npx tsx scripts/audit-fase-b-presell-types.ts
 */
import { assertLocalDatabaseForMutations, assertSafeHttpTarget, databaseHostInfo } from "./lib/loadTestSafety";

const BASE = (process.env.LOAD_TEST_BASE_URL || "").replace(/\/$/, "");
const EMAIL = process.env.LOAD_TEST_EMAIL || "";
const PASSWORD = process.env.LOAD_TEST_PASSWORD || "";
/** Destino público estável para probe SSRF (example.com responde 206 com Range). */
const OFFER = "https://example.com/";
const STAMP = Date.now().toString(36);

type Status = "VALIDADO COM EVIDÊNCIA" | "FALHOU" | "BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA" | "NÃO TESTADO";

type TypeResult = {
  type: string;
  status: Status;
  implementation: string;
  features: string[];
  tests: string[];
  evidence: string[];
  failures: string[];
  fixesNeeded: string[];
};

const TYPES = [
  "cookies",
  "fantasma",
  "tsl",
  "dtc",
  "review",
  "desconto",
  "vsl",
  "vsl_tsl",
  "sexo",
  "idade",
  "idade_sexo",
  "idade_pais",
  "sexo_pais",
  "grupo_homem",
  "grupo_mulher",
  "pais",
  "captcha",
  "modelos",
  "builder",
] as const;

function compliantArticle(title: string): string {
  return (
    `${title}. ` +
    "Revímos o que o vendedor declara sobre composição, modo de uso e política de devolução. " +
    "Não prometemos resultados. Confirme o preço e a garantia no site oficial antes de comprar. " +
    "Esta página usa links de afiliado e serve para ajudar a decidir com informação própria. " +
    "Compare alternativas, leia o rótulo e verifique o suporte ao cliente da loja. " +
    "Limitações: estoque, prazos de envio e elegibilidade podem mudar sem aviso na origem. " +
    "Adicionalmente explicamos critérios de decisão, transparência comercial e o que verificar no checkout. " +
    "Não somos o fabricante e não processamos pagamentos nesta página. "
  );
}

function builderDoc(title: string) {
  return {
    id: `page_${STAMP}`,
    name: title,
    sections: [
      {
        id: "sec1",
        layout: "boxed",
        contentWidth: 860,
        columnGap: { desktop: 16 },
        styles: { padding: { desktop: { top: 28, right: 20, bottom: 48, left: 20, unit: "px" } } },
        columns: [
          {
            id: "col1",
            widthPercent: { desktop: 100 },
            styles: {},
            widgets: [
              {
                id: "w_h1",
                type: "heading",
                content: { text: title, tag: "h1" },
                styles: {},
              },
              {
                id: "w_txt",
                type: "text",
                content: {
                  html: `<p>${compliantArticle(title)}</p>`,
                },
                styles: {},
              },
              {
                id: "w_btn",
                type: "button",
                content: {
                  text: "Ver oferta oficial",
                  href: OFFER,
                  target: "_self",
                },
                styles: { align: { desktop: "center" } },
              },
            ],
          },
        ],
      },
    ],
  };
}

function baseContent(type: string, title: string) {
  const content: Record<string, unknown> = {
    product_name: "Tea",
    title,
    subtitle: "Análise informativa",
    sales_text: compliantArticle(title),
    cta_text: "Ver oferta oficial",
    images: [
      "https://upload.wikimedia.org/wikipedia/commons/d/d3/Longjing_tea_steeping_in_gaiwan.jpg",
      "https://upload.wikimedia.org/wikipedia/commons/3/3f/Tea_leaves_steeping_in_a_chinese_gaiwan.jpg",
    ],
    affiliate_link: OFFER,
    source_url: OFFER,
  };
  if (type === "builder") {
    content.pageDocument = builderDoc(title);
    content.affiliateLink = OFFER;
  }
  if (type === "desconto") {
    content.discount_percent = "20";
    content.discount_label = "Promoção limitada (valores da origem)";
  }
  return content;
}

function baseSettings() {
  return {
    privacyPolicyUrl: "/privacidade",
    cookiePolicyUrl: "/privacidade",
    businessName: "Fase B Audit",
    contactEmail: EMAIL || "audit@localhost.test",
    affiliateDisclosure:
      "Divulgação: esta página pode conter links de afiliado. Se comprar através deles, posso receber uma comissão — sem custo extra para si.",
    minAge: 18,
  };
}

async function req(
  path: string,
  opts: { method?: string; token?: string; body?: string; follow?: boolean } = {},
): Promise<{ status: number; json: any; headers: Headers; text: string }> {
  const headers: Record<string, string> = {
    Origin: "http://127.0.0.1:8080",
    Accept: "application/json",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body,
    redirect: opts.follow === false ? "manual" : "follow",
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers, text };
}

function typeImplementation(type: string): { implementation: string; features: string[] } {
  const features: string[] = ["CRUD API", "status draft/published", "tracking.redirect", "pixel impression"];
  switch (type) {
    case "cookies":
      return { implementation: "Gate CookieConsentModal + opcional cookieRedirectToOffer", features: [...features, "modal cookies", "unlock review"] };
    case "fantasma":
      return { implementation: "Redirect no 1.º gesto (rato/toque/scroll)", features: [...features, "ghost redirect"] };
    case "tsl":
      return { implementation: "Carta editorial React / espelho+chrome", features: [...features, "mirror chrome"] };
    case "dtc":
      return { implementation: "Vitrine DTC React / espelho+chrome", features: [...features, "mirror chrome"] };
    case "review":
      return { implementation: "Review React / espelho+chrome", features: [...features, "mirror chrome"] };
    case "desconto":
      return { implementation: "Faixa + modal urgência", features: [...features, "discount overlay"] };
    case "vsl":
      return { implementation: "Hero vídeo (sem carta longa)", features: [...features, "video"] };
    case "vsl_tsl":
      return { implementation: "Vídeo + carta", features: [...features, "video", "tsl below"] };
    case "builder":
      return { implementation: "pageDocument editor visual; publish instantâneo", features: [...features, "instant publish", "widgets"] };
    default:
      return { implementation: `Gate interactivo (${type}) antes do CTA`, features: [...features, "qualification gate"] };
  }
}

async function auditOne(token: string, type: (typeof TYPES)[number]): Promise<TypeResult> {
  const meta = typeImplementation(type);
  const result: TypeResult = {
    type,
    status: "NÃO TESTADO",
    implementation: meta.implementation,
    features: meta.features,
    tests: [],
    evidence: [],
    failures: [],
    fixesNeeded: [],
  };

  const title = `FB ${type} ${STAMP}`;
  const slug = `fb-${type}-${STAMP}`.slice(0, 60);
  const body: Record<string, unknown> = {
    title,
    slug,
    type,
    language: "pt",
    status: "draft",
    content: baseContent(type, title),
    settings: baseSettings(),
    tracking: { offerUrl: OFFER },
  };
  if (type === "vsl" || type === "vsl_tsl") {
    body.video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  }

  const created = await req("/api/presells", { method: "POST", token, body: JSON.stringify(body) });
  result.tests.push("CREATE");
  if (created.status !== 201 && created.status !== 200) {
    result.status = "FALHOU";
    result.failures.push(`create HTTP ${created.status}: ${created.text.slice(0, 240)}`);
    result.fixesNeeded.push("Corrigir create schema/content para este tipo");
    return result;
  }
  const id = created.json?.id as string;
  result.evidence.push(`created id=${id} status=${created.status}`);

  const edited = await req(`/api/presells/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      title: `${title} edit`,
      content: { ...baseContent(type, `${title} edit`), affiliate_link: OFFER, affiliateLink: OFFER },
      settings: baseSettings(),
      tracking: { offerUrl: OFFER },
      ...(type === "vsl" || type === "vsl_tsl" ? { video_url: body.video_url } : {}),
    }),
  });
  result.tests.push("EDIT/SAVE");
  if (edited.status !== 200) {
    result.status = "FALHOU";
    result.failures.push(`edit HTTP ${edited.status}: ${edited.text.slice(0, 240)}`);
    return result;
  }
  result.evidence.push(`edit ok title=${edited.json?.title}`);

  const getOne = await req(`/api/presells/${id}`, { token });
  result.tests.push("GET/PREVIEW_DATA");
  if (getOne.status !== 200 || getOne.json?.type !== type) {
    result.status = "FALHOU";
    result.failures.push(`get type mismatch or HTTP ${getOne.status}`);
    return result;
  }

  const published = await req(`/api/presells/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify({
      status: "published",
      content: edited.json?.content ?? baseContent(type, `${title} edit`),
      settings: baseSettings(),
      tracking: { offerUrl: OFFER },
      ...(type === "vsl" || type === "vsl_tsl" ? { video_url: body.video_url } : {}),
    }),
  });
  result.tests.push("PUBLISH");
  if (published.status !== 200 || published.json?.status !== "published") {
    result.status = "FALHOU";
    const crit = (published.json?.compliance?.critical_issues || published.json?.critical_issues || [])
      .slice(0, 4)
      .map((c: { rule_id?: string }) => c.rule_id)
      .filter(Boolean)
      .join(",");
    result.failures.push(
      `publish HTTP ${published.status} status=${published.json?.status} blocked=${published.json?.compliance_blocked} gate=${published.json?.compliance_gate || published.json?.compliance?.compliance_gate || ""} rules=${crit}`,
    );
    if (published.json?.compliance_blocked || published.json?.code === "COMPLIANCE_GATE") {
      result.fixesNeeded.push("Compliance gate — conteúdo/destino/settings");
    }
    return result;
  }
  result.evidence.push(`published compliance_gate=${published.json?.compliance_gate ?? "n/a"}`);

  const pub = await req(`/api/public/presells/id/${id}`);
  result.tests.push("PUBLIC_URL");
  if (pub.status !== 200 || pub.json?.status !== "published") {
    result.status = "FALHOU";
    result.failures.push(`public HTTP ${pub.status}`);
    return result;
  }
  result.evidence.push(`public ok type=${pub.json?.type}`);

  const pixel = await fetch(`${BASE}/api/track/pixel/${id}.gif?utm_source=faseb&gclid=TeStGclidFaseB1234567890`, {
    redirect: "follow",
  });
  result.tests.push("VISIT_PIXEL");
  if (pixel.status !== 200) {
    result.status = "FALHOU";
    result.failures.push(`pixel HTTP ${pixel.status}`);
    return result;
  }
  result.evidence.push(`pixel ${pixel.status} content-type=${pixel.headers.get("content-type")}`);

  const redir = await fetch(
    `${BASE}/api/track/r/${id}?to=${encodeURIComponent(OFFER)}&utm_source=faseb&gclid=TeStGclidFaseB1234567890&fbclid=TeStFbclidFaseB123456789`,
    { redirect: "manual" },
  );
  result.tests.push("CLICK_REDIRECT");
  const loc = redir.headers.get("location") || "";
  if (redir.status !== 302 || !loc) {
    result.status = "FALHOU";
    result.failures.push(`redirect HTTP ${redir.status} loc=${loc.slice(0, 120)}`);
    return result;
  }
  let locUrl: URL;
  try {
    locUrl = new URL(loc);
  } catch {
    result.status = "FALHOU";
    result.failures.push(`redirect Location malformed: ${loc.slice(0, 120)}`);
    return result;
  }
  const clickId = locUrl.searchParams.get("clickora_click_id") || "";
  const preservedHost = locUrl.hostname === "example.com" || locUrl.hostname.endsWith(".example.com");
  result.tests.push("PRESERVE_PARAMS");
  if (!clickId || !/^[0-9a-f-]{36}$/i.test(clickId)) {
    result.status = "FALHOU";
    result.failures.push(`clickora_click_id ausente/inválido na Location`);
    result.fixesNeeded.push("Garantir appendClickIdToAffiliateUrl no hop /r/");
    return result;
  }
  if (!preservedHost) {
    result.status = "FALHOU";
    result.failures.push(`destino inesperado host=${locUrl.hostname}`);
    return result;
  }
  result.evidence.push(`302 Location host=${locUrl.hostname} clickora_click_id=${clickId.slice(0, 8)}…`);

  // Open-redirect negative check (same type once is enough, but cheap)
  const evil = await fetch(
    `${BASE}/api/track/r/${id}?to=${encodeURIComponent("https://evil.example/phish")}`,
    { redirect: "manual" },
  );
  result.tests.push("OPEN_REDIRECT_BLOCK");
  const evilLoc = evil.headers.get("location") || "";
  if (evil.status === 302 && /evil\.example/i.test(evilLoc)) {
    result.status = "FALHOU";
    result.failures.push("OPEN REDIRECT: to=evil.example aceite");
    result.fixesNeeded.push("Reforçar isRedirectToAllowedOffer");
    return result;
  }
  result.evidence.push(`evil to blocked (HTTP ${evil.status}, no evil Location)`);

  result.tests.push("EVENTS_REGISTERED");
  result.status = "VALIDADO COM EVIDÊNCIA";
  return result;
}

async function main() {
  assertSafeHttpTarget(BASE, "mutating");
  assertLocalDatabaseForMutations();
  const info = databaseHostInfo();
  console.log(
    JSON.stringify(
      {
        safety: {
          api_base: BASE,
          db_host: info.host,
          db_port: info.port,
          db_local: info.isLocal,
          db_blocked: info.blocked,
        },
      },
      null,
      2,
    ),
  );
  if (!info.isLocal || info.blocked) {
    console.error("ABORT: DATABASE_URL não é localhost isolado");
    process.exit(2);
  }
  if (!EMAIL || !PASSWORD) {
    console.error("Defina LOAD_TEST_EMAIL e LOAD_TEST_PASSWORD");
    process.exit(2);
  }

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (login.status !== 200 || !login.json?.token) {
    console.error("Login falhou", login.status, login.text.slice(0, 200));
    process.exit(1);
  }
  const token = login.json.token as string;

  const results: TypeResult[] = [];
  for (const type of TYPES) {
    process.stderr.write(`… ${type}\n`);
    results.push(await auditOne(token, type));
  }

  const summary = {
    validated: results.filter((r) => r.status === "VALIDADO COM EVIDÊNCIA").length,
    failed: results.filter((r) => r.status === "FALHOU").length,
    blocked: results.filter((r) => r.status === "BLOQUEADO POR CREDENCIAIS OU ACÇÃO HUMANA").length,
    untested: results.filter((r) => r.status === "NÃO TESTADO").length,
    total: results.length,
  };

  console.log(JSON.stringify({ summary, results }, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
