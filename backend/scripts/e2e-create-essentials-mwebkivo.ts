/**
 * Cria presell white essentials (Super Presell) a partir de hop mwebkivo.
 *
 * E2E_API_BASE=… E2E_EMAIL=… E2E_PASSWORD=… \
 * npx tsx scripts/e2e-create-essentials-mwebkivo.ts
 */
const API = (process.env.E2E_API_BASE || "https://clickora-production.up.railway.app/api").replace(
  /\/$/,
  "",
);
const OFFER = (
  process.env.E2E_OFFER_URL || "https://mwebkivo.com/12679/3986/46/"
).trim();
const EMAIL = process.env.E2E_EMAIL || "";
const PASS = process.env.E2E_PASSWORD || "";
if (!EMAIL || !PASS) {
  throw new Error("Defina E2E_EMAIL e E2E_PASSWORD (não há credenciais por defeito no script).");
}

async function req(path: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const r = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(240_000) });
  const text = await r.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { _raw: text.slice(0, 400) };
  }
  return { status: r.status, json };
}

async function main() {
  const login = await req("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const token = String(login.json.token || "");
  if (!token) throw new Error(`login ${login.status} ${JSON.stringify(login.json).slice(0, 200)}`);

  console.error("import hop…", OFFER);
  const imp = await req("/presells/import-from-url", {
    method: "POST",
    token,
    body: JSON.stringify({
      product_url: OFFER,
      affiliate_link: OFFER,
      language: "en",
      generation_niche: "white",
    }),
  });
  if (imp.status !== 200) {
    throw new Error(`import ${imp.status} ${JSON.stringify(imp.json).slice(0, 400)}`);
  }

  const stamp = Date.now().toString(36);
  const product = String(imp.json.product_name || imp.json.title || "Offer");
  const images = Array.isArray(imp.json.images) ? (imp.json.images as string[]).slice(0, 8) : [];
  const content = {
    title: String(imp.json.title || product).slice(0, 200),
    productName: String(imp.json.product_name || product).slice(0, 120),
    subtitle: String(imp.json.subtitle || "").slice(0, 400),
    salesText: String(imp.json.sales_text || "").slice(0, 12000),
    ctaText: String(imp.json.cta_text || "See official packages"),
    affiliateLink: String(imp.json.affiliate_link || OFFER),
    sourceUrl: String(imp.json.source_url || OFFER),
    generationNiche: "white",
    importPresentation: "essentials",
    importMode: "template",
    productImages: images,
    storefrontTheme: imp.json.storefront_theme,
    storefrontHeroTint: imp.json.storefront_hero_tint === true,
    ...(imp.json.policy_urls ? { policyUrls: imp.json.policy_urls } : {}),
    ...(imp.json.rating_from_source
      ? {
          ratingValue: imp.json.rating_value,
          ratingStars: imp.json.rating_stars ?? 5,
          ratingFromSource: true,
        }
      : {}),
  };

  const settings = {
    marketCountry: "US",
    showAffiliateTrustFooter: false,
    affiliateDisclosure:
      "Advertisement. Independent affiliate page — not the official product website. We may earn a commission if you buy through our tracked links.",
  };

  const slug = `mweb-ess-${stamp}`;
  const created = await req("/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: product.slice(0, 120),
      slug,
      type: "review",
      language: "en",
      status: "published",
      content,
      settings,
    }),
  });
  if (created.status !== 200 && created.status !== 201) {
    throw new Error(`create ${created.status} ${JSON.stringify(created.json).slice(0, 400)}`);
  }
  const id = String(created.json.id || "");
  if (!id) throw new Error("missing presell id");

  await req(`/presells/${id}/generate-review-copy`, {
    method: "POST",
    token,
    body: JSON.stringify({ force: true, angle: "review", deterministic_only: true }),
  });

  const domains = await req("/custom-domain", { token });
  const list = Array.isArray(domains.json.data)
    ? (domains.json.data as { id: string; hostname: string; status: string }[])
    : [];
  const verified = list.find((d) => d.status === "verified");
  let publicPath = `/p/${id}`;
  if (verified?.hostname) {
    await req(`/presells/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify({ custom_domain_id: verified.id }),
    });
    publicPath = `/${slug}`;
  }

  const base =
    verified?.hostname && verified.status === "verified"
      ? `https://${verified.hostname.replace(/^www\./, "")}`
      : "https://www.dclickora.com";

  console.log(
    JSON.stringify(
      {
        id,
        slug,
        product,
        imageCount: images.length,
        essentials: true,
        bareUrl: `${base}${publicPath}`,
        publicApi: `${base}/api/public/presells/id/${id}`,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});