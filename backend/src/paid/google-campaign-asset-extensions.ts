/**
 * Extensões de anúncio Search (Assets): sitelinks, destaques, snippets estruturados.
 * Persistidas em `bidding_config.google_asset_extensions` ao criar a campanha; aplicadas em `google-ads.publish`.
 */

/** Headers em inglês exigidos pela API (lista estrutured snippets Google Ads). */
export type GoogleStructuredSnippetHeader =
  | "Brands"
  | "Services"
  | "Types"
  | "Models"
  | "Destinations";

export type GoogleCampaignAssetExtensionsStored = {
  sitelinks: Array<{
    link_text: string;
    /** URL final absoluto; pode ser igual à página com fragmento diferente */
    final_url: string;
    /** Linhas extra opcionais do sitelink (benefício / detalhe) */
    description1?: string;
    description2?: string;
  }>;
  callouts: string[];
  structured_snippet: {
    header: GoogleStructuredSnippetHeader;
    values: string[];
  } | null;
};

/** Entrada minimal para gerar determinístico quando a IA omitir extensões. */
export type GoogleAssetExtensionsSeed = {
  landingUrl: string;
  offer: string;
  primaryLanguageIso: string;
};

const CALLOUT_MAX = 25;
const SITELINK_TEXT_MAX = 25;
const SNIPPET_VAL_MAX = 25;
const SNIPPET_MIN_VALUES = 3;
const SNIPPET_MAX_VALUES = 10;

const SNIPPET_HEADERS: GoogleStructuredSnippetHeader[] = [
  "Brands",
  "Services",
  "Types",
  "Models",
  "Destinations",
];

function coerceStructuredSnippetHeader(raw: string): GoogleStructuredSnippetHeader {
  const t = raw.trim();
  return SNIPPET_HEADERS.includes(t as GoogleStructuredSnippetHeader) ? (t as GoogleStructuredSnippetHeader) : "Services";
}

function isoPrimary(lang: string): string {
  const t = lang.trim().toLowerCase().split("-")[0] ?? "en";
  return t.slice(0, 2) === "pt" ? "pt" : t.slice(0, 2) === "es" ? "es" : "en";
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "").trim().slice(0, max);
}

/** Base URL só com origem + path quando possível — fragmentos combinados são acrescentados. */
function canonicalLandingBase(landingUrl: string): string {
  try {
    const u = new URL(landingUrl.trim());
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}` || landingUrl.trim();
  } catch {
    return landingUrl.trim();
  }
}

/** Gera até 6 sitelinks com o mesmo hostname e fragmentos distintos (evita 404 aleatório). */
export function buildDeterministicGoogleAssetExtensions(seed: GoogleAssetExtensionsSeed): GoogleCampaignAssetExtensionsStored {
  const base = canonicalLandingBase(seed.landingUrl);
  const lng = isoPrimary(seed.primaryLanguageIso);
  const pt = lng === "pt";
  const es = lng === "es";

  const labels: Array<{ tx: string; d1?: string; d2?: string; frag: string }> = pt
    ? [
        { tx: "Oferta", d1: "Ver página", d2: seed.offer.slice(0, 33), frag: "#oferta" },
        { tx: "Benefícios", d1: "Principais vantagens", frag: "#beneficios" },
        { tx: "Dúvidas", d1: "Perguntas frequentes", frag: "#faq" },
        { tx: "Comprar", d1: "Oferta atual", frag: "#comprar" },
        { tx: "Mais informação", frag: "#info" },
        { tx: "Contactar", frag: "#contacto" },
      ]
    : es
      ? [
          { tx: "Oferta", d1: "Ver página", frag: "#oferta" },
          { tx: "Beneficios", frag: "#beneficios" },
          { tx: "Preguntas", frag: "#faq" },
          { tx: "Comprar", frag: "#comprar" },
          { tx: "Mas info", frag: "#info" },
          { tx: "Contacto", frag: "#contacto" },
        ]
      : [
          { tx: "Offer", d1: "See landing", frag: "#offer" },
          { tx: "Benefits", frag: "#benefits" },
          { tx: "FAQ", frag: "#faq" },
          { tx: "Buy now", frag: "#buy" },
          { tx: "Details", frag: "#details" },
          { tx: "Contact", frag: "#contact" },
        ];

  const sitelinks = labels.slice(0, 6).map((x) => ({
    link_text: clip(x.tx, SITELINK_TEXT_MAX),
    final_url: `${base}${x.frag}`,
    ...(x.d1 ? { description1: clip(x.d1, 35) } : {}),
    ...(x.d2 ? { description2: clip(x.d2, 35) } : {}),
  }));

  const calloutsRaw = pt
    ? [
        "Pagamento seguro",
        "Checkout simples",
        "Oferta clara online",
        "Suporte antes de comprar",
        "Sem compromisso hoje",
        "Marcas líder no site",
      ]
    : es
      ? ["Pago seguro", "Compra rápida", "Oferta clara", "Soporte", "Sin letra pequeña oculta", "Opciones líderes"]
      : [
          "Trusted checkout",
          "Clear offer pages",
          "Fast signup",
          "Support before buying",
          "Popular online today",
          "See site for proof",
        ];
  const callouts = calloutsRaw.map((c) => clip(c, CALLOUT_MAX)).filter(Boolean);

  /** Valores a partir da oferta ou fallback — 3–10 obrigatórios para Structured Snippet (API Google). */
  const words = seed.offer.split(/\s+/).filter((w) => /^[a-záàâãçéêíóôõúüñA-Za-z]+$/.test(w) && w.length > 3);
  const uniqueWords = [...new Set(words.map((w) => w))].slice(0, SNIPPET_MAX_VALUES);
  const fill =
    pt
      ? ["Oferta digital", "Checkout simples", "Marca líder online"]
      : es
        ? ["Oferta online", "Checkout claro", "Marca popular"]
        : ["Digital offer", "Clear checkout", "Trusted site"];
  let values =
    uniqueWords.length >= SNIPPET_MIN_VALUES
      ? uniqueWords.map((v) => clip(v, SNIPPET_VAL_MAX))
      : fill.map((v) => clip(v, SNIPPET_VAL_MAX));
  if (values.length < SNIPPET_MIN_VALUES) values = fill.map((v) => clip(v, SNIPPET_VAL_MAX));
  values = values.slice(0, SNIPPET_MAX_VALUES);

  const structured_snippet: GoogleCampaignAssetExtensionsStored["structured_snippet"] = {
    header: "Services",
    values,
  };

  return { sitelinks, callouts, structured_snippet };
}

/** Une extensões parciais da IA com valores por defeito e sanitiza trim / limites. */
export function finalizeGoogleCampaignAssetExtensions(
  partial: Partial<GoogleCampaignAssetExtensionsStored> | undefined | null,
  seed: GoogleAssetExtensionsSeed,
): GoogleCampaignAssetExtensionsStored {
  const fallback = buildDeterministicGoogleAssetExtensions(seed);
  const rawSites = partial?.sitelinks?.length ? partial!.sitelinks : fallback.sitelinks;
  const sites = rawSites
    .map((s) => {
      const url = clip((s.final_url || seed.landingUrl).trim(), 1024);
      if (!/^https:\/\//i.test(url)) return null;
      return {
        link_text: clip(s.link_text || "More", SITELINK_TEXT_MAX),
        final_url: url,
        ...(s.description1 ? { description1: clip(s.description1, 35) } : {}),
        ...(s.description2 ? { description2: clip(s.description2, 35) } : {}),
      };
    })
    .filter(Boolean) as GoogleCampaignAssetExtensionsStored["sitelinks"];
  const sitelinks = sites.length >= 2 ? sites : fallback.sitelinks;

  const rawCall = partial?.callouts?.length ? partial!.callouts : fallback.callouts;
  const callouts = rawCall
    .map((c) => clip(String(c), CALLOUT_MAX))
    .filter(Boolean)
    .slice(0, 10);

  let structuredSnippet: GoogleCampaignAssetExtensionsStored["structured_snippet"] = fallback.structured_snippet;
  const st = partial?.structured_snippet;
  if (
    st?.header &&
    Array.isArray(st.values) &&
    st.values.filter((v) => String(v).trim()).length >= SNIPPET_MIN_VALUES
  ) {
    const values = st.values.map((v) => clip(String(v), SNIPPET_VAL_MAX)).filter(Boolean);
    if (values.length >= SNIPPET_MIN_VALUES) {
      structuredSnippet = {
        header: coerceStructuredSnippetHeader(String(st.header)),
        values: values.slice(0, SNIPPET_MAX_VALUES),
      };
    }
  }

  return { sitelinks, callouts, structured_snippet: structuredSnippet ?? fallback.structured_snippet };
}
