/**
 * RSA determinístico (sem IA) derivado da oferta e da landing — **nunca** do
 * objective interno (esse é briefing). Persuasivo, idioma único, alinhado com
 * os limites Google: headline ≤30, descrição ≤90.
 *
 * Densidade de keyword: ≥75 % dos títulos contêm a marca/oferta (`slug2`),
 * porque o «Quality Score» do Google penaliza headlines sem a keyword
 * principal.
 */

const H_MAX = 30;
const D_MAX = 90;

/** Quantos dos 12 títulos devem conter o slug da oferta (Google penaliza a falta). */
const TARGET_HEADLINES = 12;
const SLUG_HEADLINES_TARGET = 9;

export type GoogleRsaDeterministicInput = {
  landingUrl: string;
  offer: string;
  /** Mantido só para compatibilidade — não é usado no copy gerado. */
  objective: string;
};

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function clip(s: string, n: number): string {
  return norm(s).slice(0, n);
}

function words(s: string, n: number): string {
  return norm(s)
    .split(/\s+/)
    .slice(0, n)
    .join(" ");
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").slice(0, 22);
  } catch {
    return "site";
  }
}

function pickPrimaryLang(iso: string): "pt" | "es" | "de" | "fr" | "en" {
  const base = iso.trim().slice(0, 2).toLowerCase();
  if (base === "pt" || base === "es" || base === "de" || base === "fr") return base;
  return "en";
}

interface TemplateContext {
  slug: string;
  slug2: string;
  slug1: string;
  host: string;
}

/**
 * Templates de headlines por idioma. Estão divididos em dois grupos:
 * - `withSlug`: contêm a marca/oferta (preferidos para densidade de keyword).
 * - `extras`: persuasão sem o slug, usados apenas para variedade quando
 *   sobra espaço depois de cumprir o alvo de keyword.
 */
const HEADLINE_TEMPLATES: Record<
  "pt" | "es" | "de" | "fr" | "en",
  { withSlug: string[]; extras: string[] }
> = {
  pt: {
    withSlug: [
      "{slug2} — peça já",
      "Experimente {slug2}",
      "Descubra {slug2} hoje",
      "Compre {slug2} online",
      "{slug2} — resultados reais",
      "{slug2} de confiança",
      "Top {slug2} oficial",
      "{slug2} sem complicação",
      "Qualidade {slug2} premium",
      "{slug2} para o dia a dia",
      "Conheça o {slug2} já",
      "Peça {slug2} em segundos",
      "{slug2} aprovado por todos",
      "{slug2} — site oficial",
    ],
    extras: [
      "Página oficial em {host}",
      "Confiável, rápido e seguro",
      "Bem-estar em minutos",
      "Pedido simples e seguro",
    ],
  },
  es: {
    withSlug: [
      "{slug2} — pide ya",
      "Prueba {slug2}",
      "Descubre {slug2} hoy",
      "Compra {slug2} online",
      "{slug2} — resultados reales",
      "{slug2} de confianza",
      "Top {slug2} oficial",
      "{slug2} sin complicarse",
      "Calidad {slug2} premium",
      "{slug2} para el día a día",
      "Conoce {slug2} ahora",
      "Pide {slug2} en segundos",
      "{slug2} aprobado por todos",
      "{slug2} — sitio oficial",
    ],
    extras: [
      "Sitio oficial en {host}",
      "Fiable, rápido y seguro",
      "Bienestar en minutos",
      "Pedido simple y seguro",
    ],
  },
  de: {
    withSlug: [
      "{slug2} — jetzt bestellen",
      "{slug2} testen",
      "{slug2} heute entdecken",
      "{slug2} online kaufen",
      "{slug2} — echte Ergebnisse",
      "Vertrau auf {slug2}",
      "Top {slug2} im Shop",
      "{slug2} ganz einfach",
      "{slug2} Premiumqualität",
      "{slug2} für jeden Tag",
      "{slug2} jetzt sichern",
      "{slug2} in Sekunden bestellen",
      "{slug2} — offizielle Seite",
      "{slug2} klar erklärt",
    ],
    extras: [
      "Offizielle Seite: {host}",
      "Vertrauenswürdig & schnell",
      "Wohlfühlen in Minuten",
      "Sicher und einfach kaufen",
    ],
  },
  fr: {
    withSlug: [
      "{slug2} — commandez vite",
      "Essayez {slug2}",
      "Découvrez {slug2}",
      "Achetez {slug2} en ligne",
      "{slug2} — résultats concrets",
      "{slug2} de confiance",
      "Top {slug2} officiel",
      "{slug2} sans stress",
      "Qualité {slug2} premium",
      "{slug2} au quotidien",
      "{slug2} à découvrir",
      "{slug2} en quelques secondes",
      "{slug2} — site officiel",
      "{slug2} expliqué simplement",
    ],
    extras: [
      "Site officiel : {host}",
      "Fiable, rapide et sûr",
      "Bien-être en minutes",
      "Achat simple et sécurisé",
    ],
  },
  en: {
    withSlug: [
      "{slug2} — Order Now",
      "Try {slug2} Today",
      "Discover {slug2} Today",
      "Buy {slug2} Online",
      "{slug2} — Real Results",
      "{slug2} You Can Trust",
      "Top-Rated {slug2}",
      "{slug2} Made Easy",
      "Premium {slug2} Quality",
      "{slug2} for Everyday Use",
      "Get {slug2} Today",
      "Shop {slug2} Online",
      "{slug2} — Official Site",
      "{slug2} in a Few Clicks",
    ],
    extras: [
      "Official Site: {host}",
      "Trusted, Fast Service",
      "Boost Daily Wellness",
      "Simple, Safe Checkout",
    ],
  },
};

/** Descrições por idioma — 4 ângulos: produto, benefício, confiança, CTA. */
function descriptionsByLang(
  lang: "pt" | "es" | "de" | "fr" | "en",
  ctx: TemplateContext,
): string[] {
  if (lang === "pt") {
    return [
      `${ctx.slug} explicado em detalhe — informação clara e oficial em ${ctx.host}.`,
      `${ctx.slug2} pensado para o dia a dia — saiba o que inclui antes de comprar.`,
      `Compra confiável, checkout rápido e apoio em ${ctx.host}.`,
      `Visite ${ctx.host}, escolha a sua opção e peça ${ctx.slug2} em minutos.`,
    ];
  }
  if (lang === "es") {
    return [
      `${ctx.slug} explicado al detalle — info clara y oficial en ${ctx.host}.`,
      `${ctx.slug2} hecho para el día a día — descubra qué incluye antes de comprar.`,
      `Compra fiable, pago rápido y soporte en ${ctx.host}.`,
      `Visite ${ctx.host}, elija su opción y pida ${ctx.slug2} en minutos.`,
    ];
  }
  if (lang === "de") {
    return [
      `${ctx.slug} klar erklärt — alle Infos und das Produkt auf ${ctx.host}.`,
      `${ctx.slug2} für jeden Tag gemacht — vorab alle Details einsehen.`,
      `Sicheres Einkaufen, schneller Checkout und Support auf ${ctx.host}.`,
      `Besuchen Sie ${ctx.host} und bestellen Sie ${ctx.slug2} in Minuten.`,
    ];
  }
  if (lang === "fr") {
    return [
      `${ctx.slug} expliqué en détail — info claire et officielle sur ${ctx.host}.`,
      `${ctx.slug2} pensé pour le quotidien — voyez le contenu avant de commander.`,
      `Achat fiable, paiement rapide et support sur ${ctx.host}.`,
      `Visitez ${ctx.host} et commandez ${ctx.slug2} en quelques minutes.`,
    ];
  }
  return [
    `${ctx.slug} explained in detail — clear, official info at ${ctx.host}.`,
    `${ctx.slug2} built for everyday use — see what's included before you order.`,
    `Trusted shopping, fast checkout and full support at ${ctx.host}.`,
    `Visit ${ctx.host} today, choose your option and order ${ctx.slug2} in minutes.`,
  ];
}

function fill(template: string, ctx: TemplateContext): string {
  return template
    .replace(/\{slug2\}/g, ctx.slug2)
    .replace(/\{slug1\}/g, ctx.slug1)
    .replace(/\{slug\}/g, ctx.slug)
    .replace(/\{host\}/g, ctx.host);
}

function selectHeadlines(lang: "pt" | "es" | "de" | "fr" | "en", ctx: TemplateContext): string[] {
  const pool = HEADLINE_TEMPLATES[lang];
  const seen = new Set<string>();
  const picked: string[] = [];

  const tryPush = (raw: string): void => {
    const filled = clip(fill(raw, ctx), H_MAX);
    if (!filled) return;
    const key = filled.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(filled);
  };

  /** 1) Preenche até ao alvo de keyword (≥9 dos 12) com templates que contêm o slug. */
  for (const tpl of pool.withSlug) {
    if (picked.length >= SLUG_HEADLINES_TARGET) break;
    tryPush(tpl);
  }

  /** 2) Acrescenta templates sem slug para variedade até atingir o total. */
  for (const tpl of pool.extras) {
    if (picked.length >= TARGET_HEADLINES) break;
    tryPush(tpl);
  }

  /** 3) Se ainda falta espaço (alguns clipped/duplicados), continua a alimentar com mais templates de slug. */
  for (const tpl of pool.withSlug) {
    if (picked.length >= TARGET_HEADLINES) break;
    tryPush(tpl);
  }

  /** 4) Último recurso (raro): variações numeradas para garantir um mínimo publicável. */
  let pad = 1;
  while (picked.length < 3 && pad <= 8) {
    tryPush(`${ctx.slug2} ${pad}`);
    pad += 1;
  }

  return picked;
}

/**
 * Gera headlines (até 12) e 4 descrições alinhados com a oferta + landing,
 * em **um só** idioma (`primaryLangIso`). Não usa o `objective`.
 */
export function buildDeterministicRsa(
  input: GoogleRsaDeterministicInput,
  primaryLangIso: string,
): { headlines: string[]; descriptions: string[] } {
  const lang = pickPrimaryLang(primaryLangIso);
  const offer = norm(input.offer);
  const slug = words(offer, 3);
  const slug2 = words(offer, 2) || slug;
  const slug1 = words(offer, 1) || slug2;
  const host = hostLabel(input.landingUrl);
  const ctx: TemplateContext = { slug, slug2, slug1, host };

  const headlines = selectHeadlines(lang, ctx);
  const descriptions = descriptionsByLang(lang, ctx).map((d) => clip(d, D_MAX));

  return { headlines, descriptions };
}
