/**
 * RSA determinístico (sem IA) derivado da oferta e da landing — **nunca** do
 * objective interno (esse é briefing). Persuasivo, idioma único, alinhado com
 * os limites Google: headline ≤30, descrição ≤90.
 */

const H_MAX = 30;
const D_MAX = 90;

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

/** Templates de headlines por idioma — cada string tem placeholders `{slug}` `{slug1}` `{slug2}` `{host}`. */
const HEADLINE_TEMPLATES: Record<"pt" | "es" | "de" | "fr" | "en", string[]> = {
  pt: [
    "{slug2} — peça já",
    "Experimente {slug2}",
    "Descubra {slug1} hoje",
    "Qualidade {slug1} Premium",
    "Bem-estar em minutos",
    "Compra simples e segura",
    "Página oficial: {host}",
    "Resultados que se notam",
    "{slug1} top no site",
    "Comece já em minutos",
    "Confiável e rápido",
    "Feito para o dia a dia",
    "{slug2} sem complicação",
    "Peça online em segundos",
    "Veja {host} e decida",
    "{slug1} de confiança",
  ],
  es: [
    "{slug2} — pide ya",
    "Prueba {slug2}",
    "Descubre {slug1} hoy",
    "Calidad {slug1} Premium",
    "Bienestar en minutos",
    "Compra simple y segura",
    "Sitio oficial: {host}",
    "Resultados que se notan",
    "{slug1} top en la web",
    "Empieza ya en minutos",
    "Fiable y rápido",
    "Hecho para el día a día",
    "{slug2} sin complicarse",
    "Pide online en segundos",
    "Mira {host} y decide",
    "{slug1} de confianza",
  ],
  de: [
    "{slug2} — jetzt sichern",
    "{slug2} testen",
    "Entdecke {slug1} heute",
    "{slug1} Premiumqualität",
    "Wohlfühl-Boost",
    "Einfach & sicher kaufen",
    "Offizielle Seite: {host}",
    "Spürbare Ergebnisse",
    "Top {slug1} im Shop",
    "In Minuten starten",
    "Vertrauenswürdig & schnell",
    "Für jeden Tag gemacht",
    "{slug2} ganz einfach",
    "In Sekunden bestellen",
    "{host} besuchen",
    "{slug1} Sie können vertrauen",
  ],
  fr: [
    "{slug2} — commandez vite",
    "Essayez {slug2}",
    "Découvrez {slug1}",
    "Qualité {slug1} premium",
    "Bien-être en minutes",
    "Achat simple et sûr",
    "Site officiel : {host}",
    "Des résultats concrets",
    "{slug1} top sur le site",
    "Démarrez en minutes",
    "Fiable et rapide",
    "Pensé pour le quotidien",
    "{slug2} sans stress",
    "Commandez en secondes",
    "Voir {host} & choisir",
    "{slug1} de confiance",
  ],
  en: [
    "{slug2} — Order Now",
    "Try {slug2} Today",
    "Discover {slug1} Today",
    "Premium {slug1} Quality",
    "Boost Daily Wellness",
    "Simple, Safe Checkout",
    "Official Site: {host}",
    "Real Results You Notice",
    "Top {slug1} Online",
    "Start in a Few Minutes",
    "Trusted, Fast Service",
    "Made for Everyday Use",
    "{slug2} Made Easy",
    "Order Online in Seconds",
    "Visit {host} & Decide",
    "{slug1} You Can Trust",
  ],
};

/** Descrições por idioma — 4 ângulos: produto, benefício, confiança, CTA. */
function descriptionsByLang(
  lang: "pt" | "es" | "de" | "fr" | "en",
  ctx: TemplateContext,
): string[] {
  if (lang === "pt") {
    return [
      `${ctx.slug} explicado em detalhe — informação clara e oficial em ${ctx.host}.`,
      `Pensado para o dia a dia — saiba o que inclui antes de comprar.`,
      `Compra confiável, checkout rápido e apoio em ${ctx.host}.`,
      `Visite ${ctx.host} agora, escolha a sua opção e peça em minutos.`,
    ];
  }
  if (lang === "es") {
    return [
      `${ctx.slug} explicado al detalle — info clara y oficial en ${ctx.host}.`,
      `Hecho para el día a día — descubra qué incluye antes de comprar.`,
      `Compra fiable, pago rápido y soporte en ${ctx.host}.`,
      `Visite ${ctx.host} hoy, elija su opción y pida en minutos.`,
    ];
  }
  if (lang === "de") {
    return [
      `${ctx.slug} klar erklärt — alle Infos und das Produkt auf ${ctx.host}.`,
      `Für jeden Tag gemacht — vorab alle Details zum Inhalt einsehen.`,
      `Sicheres Einkaufen, schneller Checkout und Support auf ${ctx.host}.`,
      `Besuchen Sie ${ctx.host}, wählen Sie Ihre Option und bestellen.`,
    ];
  }
  if (lang === "fr") {
    return [
      `${ctx.slug} expliqué en détail — info claire et officielle sur ${ctx.host}.`,
      `Pensé pour le quotidien — voyez le contenu avant de commander.`,
      `Achat fiable, paiement rapide et support sur ${ctx.host}.`,
      `Visitez ${ctx.host} aujourd'hui, choisissez votre option et commandez.`,
    ];
  }
  return [
    `${ctx.slug} explained in detail — clear, official info at ${ctx.host}.`,
    `Built for everyday use — see what's included before you order.`,
    `Trusted shopping, fast checkout and full support at ${ctx.host}.`,
    `Visit ${ctx.host} today, choose your option and order in minutes.`,
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
  const seen = new Set<string>();
  const picked: string[] = [];

  for (const tpl of HEADLINE_TEMPLATES[lang]) {
    if (picked.length >= 12) break;
    const filled = clip(fill(tpl, ctx), H_MAX);
    if (!filled || seen.has(filled.toLowerCase())) continue;
    seen.add(filled.toLowerCase());
    picked.push(filled);
  }

  /** Fallback raro: se algum template ficou vazio depois do clip, completar com variações curtas. */
  let pad = 1;
  while (picked.length < 3 && pad <= 8) {
    const candidate = clip(`${ctx.slug2} ${pad}`, H_MAX);
    if (!seen.has(candidate.toLowerCase())) {
      seen.add(candidate.toLowerCase());
      picked.push(candidate);
    }
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
