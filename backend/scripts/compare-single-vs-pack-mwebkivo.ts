/** Compara 1 página vs pacote 3 variantes — mwebkivo. */
const API = (process.env.E2E_API_BASE || "http://127.0.0.1:3001/api").replace(/\/$/, "");
const FE = (process.env.E2E_FE_BASE || "http://127.0.0.1:8080").replace(/\/$/, "");
const OFFER = "https://mwebkivo.com/8389/5494/7/";

type Json = Record<string, unknown>;

async function req(path: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const r = await fetch(`${API}${path}`, { ...init, headers, signal: AbortSignal.timeout(180_000) });
  const text = await r.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { _raw: text.slice(0, 200) };
  }
  return { status: r.status, json };
}

async function main() {
  const stamp = Date.now();
  const email = `cmp-${stamp}@clickora.local`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "E2eFactory!Pass99",
      full_name: "Compare Pack",
      accept_policies: true,
    }),
  });
  const token = String(reg.json.token || "");
  if (!token) throw new Error(`auth ${reg.status}`);

  const imp = await req("/presells/import-from-url", {
    method: "POST",
    token,
    body: JSON.stringify({
      product_url: OFFER,
      affiliate_link: OFFER,
      language: "pt-BR",
      generation_niche: "black",
    }),
  });
  const product = String(imp.json.product_name || imp.json.title || "Neotonics");
  const images = Array.isArray(imp.json.images) ? (imp.json.images as string[]).slice(0, 6) : [];
  const settings = {
    businessName: "Compare Operator",
    contactEmail: email,
    showAffiliateTrustFooter: false,
    affiliateDisclosure: "Divulgação: comissão de afiliado sem custo extra.",
  };
  const contentBase = () => ({
    title: String(imp.json.title || product),
    productName: product,
    subtitle: String(imp.json.subtitle || ""),
    salesText: String(imp.json.sales_text || ""),
    sales_text: String(imp.json.sales_text || ""),
    ctaText: String(imp.json.cta_text || "Continuar para a página oficial da oferta"),
    affiliateLink: OFFER,
    generationNiche: "black",
    productImages: images,
    importMode: imp.json.import_mode,
    ...(typeof imp.json.import_mirror_src_doc === "string"
      ? { importMirrorSrcDoc: imp.json.import_mirror_src_doc }
      : {}),
  });

  const single = await req("/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `CMP single ${product}`,
      slug: `cmp-single-${stamp.toString(36)}`,
      type: "review",
      language: "pt-BR",
      status: "published",
      content: contentBase(),
      settings,
    }),
  });
  const singleId = String(single.json.id || "");
  await req(`/presells/${singleId}/generate-review-copy`, {
    method: "POST",
    token,
    body: JSON.stringify({ force: true, angle: "review", deterministic_only: true }),
  });

  const packBase = await req("/presells", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: `CMP pack ${product}`,
      slug: `cmp-pack-${stamp.toString(36)}`,
      type: "review",
      language: "pt-BR",
      status: "published",
      content: contentBase(),
      settings,
    }),
  });
  const packId = String(packBase.json.id || "");
  const pack = await req(`/presells/${packId}/spawn-variant-pack`, {
    method: "POST",
    token,
    body: JSON.stringify({ create_rotator: true, deterministic_only: true }),
  });
  const pages = (pack.json.pages || {}) as Record<string, { id?: string; slug?: string; status?: string }>;
  const ids = {
    landing: String(pages.landing?.id || ""),
    review: String(pages.review?.id || ""),
    advertorial: String(pages.advertorial?.id || ""),
  };

  async function snap(id: string, label: string) {
    const r = await req(`/presells/${id}`, { token });
    const c = (r.json.content || {}) as Json;
    const pillars = Array.isArray(c.articlePillars)
      ? (c.articlePillars as Array<{ title?: string }>).map((p) => p.title)
      : [];
    return {
      label,
      id,
      type: r.json.type,
      status: r.json.status,
      kicker: c.articleKicker,
      headline: c.articleHeadline,
      pillars,
      intro: String(c.articleIntro || "").slice(0, 180),
      public: `${FE}/p/${id}`,
    };
  }

  const snaps = [
    await snap(singleId, "SINGLE (sem pacote)"),
    await snap(ids.landing, "PACK · landing/tsl"),
    await snap(ids.review, "PACK · review"),
    await snap(ids.advertorial, "PACK · advertorial"),
  ];

  const rot = await req("/traffic-rotators", {
    method: "POST",
    token,
    body: JSON.stringify({
      name: `CMP pack ${stamp}`,
      slug: `cmp-pack-${stamp.toString(36)}`,
      mode: "weighted",
      context_presell_id: packId,
      is_active: true,
      sticky_session: true,
      arms: [
        { destination_url: `${FE}/p/${ids.landing}`, label: "Landing", order_index: 0, weight: 33 },
        { destination_url: `${FE}/p/${ids.review}`, label: "Review", order_index: 1, weight: 33 },
        { destination_url: `${FE}/p/${ids.advertorial}`, label: "Advertorial", order_index: 2, weight: 34 },
      ],
    }),
  });

  console.log(
    JSON.stringify(
      {
        product,
        offer: OFFER,
        single: { id: singleId, url: `${FE}/p/${singleId}` },
        pack: { baseId: packId, ids, statuses: pages },
        rotator: rot.json.public_click_url,
        snaps,
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
