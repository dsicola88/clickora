/**
 * RSA determinístico (sem IA) derivado da oferta, da landing e dos **sinais
 * reais do produto** (preço, desconto, garantia, envio, bundles, bónus,
 * certificações, atributos). Nunca usa o `objective` interno.
 *
 * Princípios (alinhados com copies vencedores afiliados):
 *  - **Nada é inventado.** Se um sinal não foi fornecido, o template que
 *    dependeria dele simplesmente não é gerado.
 *  - Densidade de keyword: ≥75 % dos títulos contêm a marca/oferta (`slug2`).
 *  - Idioma único — `primaryLangIso` resolve o pool e tudo sai nessa língua.
 *  - Limites Google: headline ≤30, descrição ≤90.
 */
import type { GoogleProductSignals } from "./google-campaign-ai-shared";

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

type Lang = "pt" | "es" | "de" | "fr" | "en";

/** Templates "estáveis" (sem sinais). Usados quando product_signals está ausente ou para preencher o resto. */
const HEADLINE_TEMPLATES: Record<Lang, { withSlug: string[]; extras: string[] }> = {
  pt: {
    withSlug: [
      "{slug2} — peça já",
      "Experimente {slug2}",
      "Descubra {slug2} hoje",
      "Compre {slug2} online",
      "{slug2} — site oficial",
      "{slug2} de confiança",
      "Top {slug2} oficial",
      "Qualidade {slug2} premium",
      "{slug2} para o dia a dia",
      "Conheça o {slug2} já",
      "{slug2} — peça em segundos",
      "{slug2} aprovado por todos",
    ],
    extras: ["Página oficial em {host}", "Confiável, rápido e seguro", "Pedido simples e seguro"],
  },
  es: {
    withSlug: [
      "{slug2} — pide ya",
      "Prueba {slug2}",
      "Descubre {slug2} hoy",
      "Compra {slug2} online",
      "{slug2} — sitio oficial",
      "{slug2} de confianza",
      "Top {slug2} oficial",
      "Calidad {slug2} premium",
      "{slug2} para el día a día",
      "Conoce {slug2} ahora",
      "{slug2} — pide en segundos",
      "{slug2} aprobado por todos",
    ],
    extras: ["Sitio oficial en {host}", "Fiable, rápido y seguro", "Pedido simple y seguro"],
  },
  de: {
    withSlug: [
      "{slug2} — jetzt bestellen",
      "{slug2} testen",
      "{slug2} heute entdecken",
      "{slug2} online kaufen",
      "{slug2} — offizielle Seite",
      "Vertrau auf {slug2}",
      "Top {slug2} im Shop",
      "{slug2} Premiumqualität",
      "{slug2} für jeden Tag",
      "{slug2} jetzt sichern",
      "{slug2} in Sekunden bestellen",
      "{slug2} klar erklärt",
    ],
    extras: ["Offizielle Seite: {host}", "Vertrauenswürdig & schnell", "Sicher und einfach kaufen"],
  },
  fr: {
    withSlug: [
      "{slug2} — à commander",
      "Essayez {slug2}",
      "Découvrez {slug2}",
      "Achetez {slug2} en ligne",
      "{slug2} — site officiel",
      "{slug2} de confiance",
      "Top {slug2} officiel",
      "Qualité {slug2} premium",
      "{slug2} au quotidien",
      "{slug2} à découvrir",
      "{slug2} en quelques clics",
      "{slug2} clair et simple",
    ],
    extras: ["Site officiel : {host}", "Fiable, rapide et sûr", "Achat simple et sécurisé"],
  },
  en: {
    withSlug: [
      "{slug2} — Order Now",
      "Try {slug2} Today",
      "Discover {slug2} Today",
      "Buy {slug2} Online",
      "{slug2} — Official Site",
      "{slug2} You Can Trust",
      "Top-Rated {slug2}",
      "Premium {slug2} Quality",
      "{slug2} for Everyday Use",
      "Get {slug2} Today",
      "Shop {slug2} Online",
      "{slug2} in a Few Clicks",
    ],
    extras: ["Official Site: {host}", "Trusted, Fast Service", "Simple, Safe Checkout"],
  },
};

function fill(template: string, ctx: TemplateContext): string {
  return template
    .replace(/\{slug2\}/g, ctx.slug2)
    .replace(/\{slug1\}/g, ctx.slug1)
    .replace(/\{slug\}/g, ctx.slug)
    .replace(/\{host\}/g, ctx.host);
}

/**
 * Templates dinâmicos *condicionais* aos sinais reais. Cada bloco só corre
 * se o sinal correspondente foi fornecido — isto garante que **nunca**
 * inventamos preço/desconto/garantia/envio/bundle/bónus/certificação/atributo.
 */
function buildDynamicHeadlines(
  lang: Lang,
  ctx: TemplateContext,
  s: GoogleProductSignals,
): string[] {
  const out: string[] = [];
  /**
   * Rejeita headlines em que o trunc a 30 chars cortou a marca ou um sinal
   * relevante a meio da palavra (ex.: "Save 77% Off on Long Brand Na…"). Só
   * aceitamos a versão integral quando cabe — caso contrário, o template
   * é descartado e o pool tem alternativas que servem.
   */
  const push = (t: string): void => {
    const full = norm(t);
    if (!full) return;
    const c = clip(full, H_MAX);
    if (full.length > H_MAX) {
      const slug2Lower = ctx.slug2.toLowerCase();
      if (slug2Lower && full.toLowerCase().includes(slug2Lower) && !c.toLowerCase().includes(slug2Lower)) {
        return;
      }
      const watch = [s.price, s.discount, s.guarantee, s.shipping, s.bonuses];
      for (const w of watch) {
        if (!w) continue;
        const wl = w.toLowerCase();
        if (full.toLowerCase().includes(wl) && !c.toLowerCase().includes(wl)) return;
      }
    }
    out.push(c);
  };

  if (lang === "en") {
    if (s.price) {
      push(`${ctx.slug2} Just ${s.price}`);
      push(`Get ${ctx.slug2} at ${s.price}`);
      push(`Only ${s.price} on ${ctx.slug2}`);
    }
    if (s.discount) {
      push(`${ctx.slug2} ${s.discount} Today`);
      push(`Save ${s.discount} on ${ctx.slug2}`);
      push(`${s.discount} on ${ctx.slug2} Today`);
    }
    if (s.guarantee) {
      push(s.guarantee);
      push(`${ctx.slug2} + ${s.guarantee}`);
    }
    if (s.shipping) {
      push(s.shipping);
      push(`${ctx.slug2} + ${s.shipping}`);
    }
    if (s.bonuses) {
      push(`${ctx.slug2} + ${s.bonuses}`);
      push(`${s.bonuses} Today`);
    }
    if (s.certifications) push(s.certifications);
    if (s.bundles) for (const b of s.bundles) push(b);
    if (s.attributes) for (const a of s.attributes) push(a);
  } else if (lang === "pt") {
    if (s.price) {
      push(`${ctx.slug2} por ${s.price}`);
      push(`Apenas ${s.price} em ${ctx.slug2}`);
      push(`Compre ${ctx.slug2} ${s.price}`);
    }
    if (s.discount) {
      push(`${ctx.slug2} ${s.discount} hoje`);
      push(`Poupe ${s.discount} em ${ctx.slug2}`);
      push(`${s.discount} em ${ctx.slug2}`);
    }
    if (s.guarantee) {
      push(s.guarantee);
      push(`${ctx.slug2} + ${s.guarantee}`);
    }
    if (s.shipping) {
      push(s.shipping);
      push(`${ctx.slug2} + ${s.shipping}`);
    }
    if (s.bonuses) {
      push(`${ctx.slug2} + ${s.bonuses}`);
      push(`${s.bonuses} hoje`);
    }
    if (s.certifications) push(s.certifications);
    if (s.bundles) for (const b of s.bundles) push(b);
    if (s.attributes) for (const a of s.attributes) push(a);
  } else if (lang === "es") {
    if (s.price) {
      push(`${ctx.slug2} por ${s.price}`);
      push(`Solo ${s.price} en ${ctx.slug2}`);
      push(`Compra ${ctx.slug2} ${s.price}`);
    }
    if (s.discount) {
      push(`${ctx.slug2} ${s.discount} hoy`);
      push(`Ahorra ${s.discount} en ${ctx.slug2}`);
      push(`${s.discount} en ${ctx.slug2}`);
    }
    if (s.guarantee) {
      push(s.guarantee);
      push(`${ctx.slug2} + ${s.guarantee}`);
    }
    if (s.shipping) {
      push(s.shipping);
      push(`${ctx.slug2} + ${s.shipping}`);
    }
    if (s.bonuses) {
      push(`${ctx.slug2} + ${s.bonuses}`);
      push(`${s.bonuses} hoy`);
    }
    if (s.certifications) push(s.certifications);
    if (s.bundles) for (const b of s.bundles) push(b);
    if (s.attributes) for (const a of s.attributes) push(a);
  } else if (lang === "de") {
    if (s.price) {
      push(`${ctx.slug2} ab ${s.price}`);
      push(`Nur ${s.price} für ${ctx.slug2}`);
      push(`${ctx.slug2} kaufen ${s.price}`);
    }
    if (s.discount) {
      push(`${ctx.slug2} ${s.discount} heute`);
      push(`Sparen Sie ${s.discount}`);
    }
    if (s.guarantee) {
      push(s.guarantee);
      push(`${ctx.slug2} + ${s.guarantee}`);
    }
    if (s.shipping) {
      push(s.shipping);
      push(`${ctx.slug2} + ${s.shipping}`);
    }
    if (s.bonuses) {
      push(`${ctx.slug2} + ${s.bonuses}`);
      push(`${s.bonuses} heute`);
    }
    if (s.certifications) push(s.certifications);
    if (s.bundles) for (const b of s.bundles) push(b);
    if (s.attributes) for (const a of s.attributes) push(a);
  } else if (lang === "fr") {
    if (s.price) {
      push(`${ctx.slug2} dès ${s.price}`);
      push(`Seulement ${s.price} sur ${ctx.slug2}`);
      push(`${ctx.slug2} à ${s.price}`);
    }
    if (s.discount) {
      push(`${ctx.slug2} : ${s.discount}`);
      push(`${s.discount} sur ${ctx.slug2}`);
      push(`Économisez ${s.discount}`);
    }
    if (s.guarantee) {
      push(s.guarantee);
      push(`${ctx.slug2} + ${s.guarantee}`);
    }
    if (s.shipping) {
      push(s.shipping);
      push(`${ctx.slug2} + ${s.shipping}`);
    }
    if (s.bonuses) {
      push(`${ctx.slug2} + ${s.bonuses}`);
      push(`${s.bonuses} offerts`);
    }
    if (s.certifications) push(s.certifications);
    if (s.bundles) for (const b of s.bundles) push(b);
    if (s.attributes) for (const a of s.attributes) push(a);
  }

  return out;
}

/** Descrições por idioma — sempre genéricas, sem inventar promo. */
function staticDescriptions(lang: Lang, ctx: TemplateContext): string[] {
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

/**
 * Descrições dinâmicas — cada uma só é candidata se TODOS os sinais que
 * referencia foram fornecidos. Composição vinda dos modelos validados do
 * PDF de exemplos (afiliados de saúde/suplementos), agora generalizados.
 */
function buildDynamicDescriptions(
  lang: Lang,
  ctx: TemplateContext,
  s: GoogleProductSignals,
): string[] {
  const out: string[] = [];
  const push = (t: string): void => {
    const c = clip(t, D_MAX);
    if (c) out.push(c);
  };

  if (lang === "en") {
    if (s.discount && s.shipping) {
      push(`Buy ${ctx.slug2} now on the official site with ${s.discount} + ${s.shipping} today.`);
    }
    if (s.guarantee && s.shipping) {
      push(`Get ${ctx.slug2} with ${s.shipping}. You have ${s.guarantee}.`);
    }
    if (s.guarantee && s.bonuses) {
      push(`${s.guarantee} + ${s.bonuses}. Order ${ctx.slug2} on the official site today.`);
    }
    if (s.guarantee) {
      push(`${s.guarantee}. Take advantage of this offer and order ${ctx.slug2} today.`);
    }
    if (s.discount && s.bonuses) {
      push(`Get a special ${s.discount} today + ${s.bonuses}. Order ${ctx.slug1} now.`);
    }
    if (s.price && s.shipping) {
      push(`Order ${ctx.slug2} for only ${s.price} on the official site + ${s.shipping}.`);
    }
    if (s.bundles?.[0] && s.shipping) {
      push(`${s.bundles[0]} + ${s.shipping}. Limited time — order ${ctx.slug1} today.`);
    }
    if (s.certifications) {
      push(`${ctx.slug2} ${s.certifications}. Order today on the official website.`);
    }
    if (s.attributes?.length) {
      push(`${s.attributes.slice(0, 3).join(". ")}. Order ${ctx.slug2} on the official site.`);
    }
  } else if (lang === "pt") {
    if (s.discount && s.shipping) {
      push(`Compre ${ctx.slug2} agora no site oficial com ${s.discount} + ${s.shipping} hoje.`);
    }
    if (s.guarantee && s.shipping) {
      push(`Receba ${ctx.slug2} com ${s.shipping}. Tem ${s.guarantee}.`);
    }
    if (s.guarantee) {
      push(`${s.guarantee}. Aproveite a oferta e peça ${ctx.slug2} hoje.`);
    }
    if (s.discount && s.bonuses) {
      push(`Aproveite ${s.discount} hoje + ${s.bonuses}. Peça ${ctx.slug1} agora.`);
    }
    if (s.price && s.shipping) {
      push(`Peça ${ctx.slug2} por apenas ${s.price} no site oficial + ${s.shipping}.`);
    }
    if (s.bundles?.[0] && s.shipping) {
      push(`${s.bundles[0]} + ${s.shipping}. Tempo limitado — peça ${ctx.slug1} hoje.`);
    }
    if (s.certifications) {
      push(`${ctx.slug2} ${s.certifications}. Peça hoje no site oficial.`);
    }
    if (s.attributes?.length) {
      push(`${s.attributes.slice(0, 3).join(". ")}. Peça ${ctx.slug2} no site oficial.`);
    }
  } else if (lang === "es") {
    if (s.discount && s.shipping) {
      push(`Compre ${ctx.slug2} ahora en el sitio oficial con ${s.discount} + ${s.shipping} hoy.`);
    }
    if (s.guarantee && s.shipping) {
      push(`Reciba ${ctx.slug2} con ${s.shipping}. Tiene ${s.guarantee}.`);
    }
    if (s.guarantee) {
      push(`${s.guarantee}. Aproveche la oferta y pida ${ctx.slug2} hoy.`);
    }
    if (s.discount && s.bonuses) {
      push(`Aproveche ${s.discount} hoy + ${s.bonuses}. Pida ${ctx.slug1} ahora.`);
    }
    if (s.price && s.shipping) {
      push(`Pida ${ctx.slug2} por solo ${s.price} en el sitio oficial + ${s.shipping}.`);
    }
    if (s.bundles?.[0] && s.shipping) {
      push(`${s.bundles[0]} + ${s.shipping}. Tiempo limitado — pida ${ctx.slug1} hoy.`);
    }
    if (s.certifications) {
      push(`${ctx.slug2} ${s.certifications}. Pida hoy en el sitio oficial.`);
    }
    if (s.attributes?.length) {
      push(`${s.attributes.slice(0, 3).join(". ")}. Pida ${ctx.slug2} en el sitio oficial.`);
    }
  } else if (lang === "de") {
    if (s.discount && s.shipping) {
      push(`Kaufen Sie ${ctx.slug2} jetzt auf der offiziellen Seite mit ${s.discount} + ${s.shipping}.`);
    }
    if (s.guarantee && s.shipping) {
      push(`${ctx.slug2} mit ${s.shipping}. Sie erhalten ${s.guarantee}.`);
    }
    if (s.guarantee) {
      push(`${s.guarantee}. Nutzen Sie das Angebot und bestellen Sie ${ctx.slug2} heute.`);
    }
    if (s.price && s.shipping) {
      push(`Bestellen Sie ${ctx.slug2} ab ${s.price} auf der offiziellen Seite + ${s.shipping}.`);
    }
    if (s.bundles?.[0] && s.shipping) {
      push(`${s.bundles[0]} + ${s.shipping}. Heute bestellen.`);
    }
    if (s.certifications) {
      push(`${ctx.slug2} ${s.certifications}. Heute auf der offiziellen Seite bestellen.`);
    }
    if (s.attributes?.length) {
      push(`${s.attributes.slice(0, 3).join(". ")}. ${ctx.slug2} auf der offiziellen Seite.`);
    }
  } else if (lang === "fr") {
    if (s.discount && s.shipping) {
      push(`Achetez ${ctx.slug2} sur le site officiel — ${s.discount} + ${s.shipping}.`);
    }
    if (s.guarantee && s.shipping) {
      push(`${ctx.slug2} avec ${s.shipping}. Vous avez ${s.guarantee}.`);
    }
    if (s.guarantee) {
      push(`${s.guarantee}. Profitez de l'offre et commandez ${ctx.slug2}.`);
    }
    if (s.price && s.shipping) {
      push(`Commandez ${ctx.slug2} dès ${s.price} sur le site officiel + ${s.shipping}.`);
    }
    if (s.bundles?.[0] && s.shipping) {
      push(`${s.bundles[0]} + ${s.shipping}. Offre limitée — commandez vite.`);
    }
    if (s.certifications) {
      push(`${ctx.slug2} ${s.certifications}. Commandez sur le site officiel.`);
    }
    if (s.attributes?.length) {
      push(`${s.attributes.slice(0, 3).join(". ")}. Commandez ${ctx.slug2} sur le site officiel.`);
    }
  }

  return out;
}

function selectHeadlines(
  lang: Lang,
  ctx: TemplateContext,
  signals: GoogleProductSignals | undefined,
): string[] {
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

  /** 1) Sinais reais primeiro — copy específico vence sempre (até 7 títulos com signals). */
  if (signals) {
    const dynamic = buildDynamicHeadlines(lang, ctx, signals);
    for (const h of dynamic) {
      if (picked.length >= 7) break;
      tryPush(h);
    }
  }

  /** 2) Branded com slug — completa o alvo de keyword density. */
  for (const tpl of HEADLINE_TEMPLATES[lang].withSlug) {
    if (picked.length >= SLUG_HEADLINES_TARGET) break;
    tryPush(tpl);
  }

  /** 3) Extras sem slug — variedade até atingir o total. */
  for (const tpl of HEADLINE_TEMPLATES[lang].extras) {
    if (picked.length >= TARGET_HEADLINES) break;
    tryPush(tpl);
  }

  /** 4) Continua com mais branded se ainda falta (alguns clipped/duplicados). */
  for (const tpl of HEADLINE_TEMPLATES[lang].withSlug) {
    if (picked.length >= TARGET_HEADLINES) break;
    tryPush(tpl);
  }

  /** 5) Último recurso: variações numeradas para o mínimo publicável. */
  let pad = 1;
  while (picked.length < 3 && pad <= 8) {
    tryPush(`${ctx.slug2} ${pad}`);
    pad += 1;
  }

  return picked;
}

function selectDescriptions(
  lang: Lang,
  ctx: TemplateContext,
  signals: GoogleProductSignals | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const tryPush = (raw: string): void => {
    const c = clip(raw, D_MAX);
    if (!c) return;
    const key = c.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  /** Sinais reais primeiro — até 3 descrições. */
  if (signals) {
    for (const d of buildDynamicDescriptions(lang, ctx, signals)) {
      if (out.length >= 3) break;
      tryPush(d);
    }
  }

  /** Completa com descrições estáticas (sempre verdadeiras). */
  for (const d of staticDescriptions(lang, ctx)) {
    if (out.length >= 4) break;
    tryPush(d);
  }

  return out.slice(0, 4);
}

/**
 * Gera headlines (até 12) e 4 descrições alinhados com a oferta + landing,
 * em **um só** idioma (`primaryLangIso`). Não usa o `objective`.
 *
 * Os sinais reais do produto (preço, desconto, garantia, envio, bundles,
 * bónus, certificações, atributos) entram como copy *quando existem*.
 * Caso o utilizador não os forneça, o copy fica seguro (apenas marca +
 * landing), sem inventar promoções.
 */
export function buildDeterministicRsa(
  input: GoogleRsaDeterministicInput,
  primaryLangIso: string,
  productSignals?: GoogleProductSignals,
): { headlines: string[]; descriptions: string[] } {
  const lang = pickPrimaryLang(primaryLangIso);
  const offer = norm(input.offer);
  const slug = words(offer, 3);
  const slug2 = words(offer, 2) || slug;
  const slug1 = words(offer, 1) || slug2;
  const host = hostLabel(input.landingUrl);
  const ctx: TemplateContext = { slug, slug2, slug1, host };

  return {
    headlines: selectHeadlines(lang, ctx, productSignals),
    descriptions: selectDescriptions(lang, ctx, productSignals),
  };
}
