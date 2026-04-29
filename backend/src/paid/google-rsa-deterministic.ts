/** RSA de fallback 100% derivado da oferta, objetivo e URL (limite Google: 30/90). */

const H = 30;
const D = 90;

export type GoogleRsaDeterministicInput = {
  landingUrl: string;
  offer: string;
  objective: string;
};

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function mkHead(s: string): string {
  return norm(s).slice(0, H);
}

function mkDesc(s: string): string {
  return norm(s).slice(0, D);
}

function words(s: string, n: number): string {
  return norm(s)
    .split(/\s+/)
    .slice(0, n)
    .join(" ");
}

/** Primeira frase ou segmento até ~maxC caracteres (para caber no RSA). */
function objHead(obj: string, maxC: number): string {
  const t = norm(obj);
  const first = (t.split(/[.!?;\n]/)[0] ?? t).trim();
  return first.slice(0, maxC);
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").slice(0, 22);
  } catch {
    return "site";
  }
}

function uniqueHeads(seq: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of seq) {
    const t = mkHead(raw);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function padTo12(candidates: string[], offerFull: string, slug: string): string[] {
  let merged = uniqueHeads(candidates);
  if (merged.length >= 12) return merged.slice(0, 12);
  for (let k = 8; k <= 40 && merged.length < 12; k++) {
    merged = uniqueHeads([...merged, mkHead(words(offerFull, k))]);
  }
  let i = 0;
  while (merged.length < 12 && i < 48) {
    const seg = mkHead(
      norm(offerFull).slice(i, i + H) || `${slug} ${merged.length + 1}`,
    );
    merged = uniqueHeads([...merged, seg]);
    i += 3;
  }
  let guard = 0;
  while (merged.length < 12 && guard < 20) {
    guard += 1;
    merged = uniqueHeads([...merged, mkHead(`${slug} · opt ${guard}`)]);
  }
  return merged.slice(0, 12);
}

/**
 * Gera 12 títulos e 4 descrições alinhados com a campanha (sem IA).
 * `primaryLangIso`: primeiro segmento ISO 639-1 (ex.: pt, es, de, fr, en).
 */
export function buildDeterministicRsa(
  input: GoogleRsaDeterministicInput,
  primaryLangIso: string,
): { headlines: string[]; descriptions: string[] } {
  const slug = words(input.offer, 3);
  const offerF = norm(input.offer);
  const objF = norm(input.objective);
  const host = hostLabel(input.landingUrl);
  const base = primaryLangIso.trim().slice(0, 2).toLowerCase();

  const d1 = mkDesc(offerF);
  const dRest = (): [string, string, string] => {
    if (base === "pt") {
      return [
        mkDesc(`${objHead(objF, 88)} Confira ${host}.`),
        mkDesc(`Objetivo: ${words(objF, 14)} Página oficial com todos os detalhes.`),
        mkDesc(`Compre com tranquilidade — informação completa em ${host}.`),
      ];
    }
    if (base === "es") {
      return [
        mkDesc(`${objHead(objF, 88)} Más en ${host}.`),
        mkDesc(`Objetivo: ${words(objF, 14)} Toda la info en la web oficial.`),
        mkDesc(`Compra con calma — detalles completos en ${host}.`),
      ];
    }
    if (base === "de") {
      return [
        mkDesc(`${objHead(objF, 88)} Mehr auf ${host}.`),
        mkDesc(`Ziel: ${words(objF, 14)} Alle Infos auf der offiziellen Seite.`),
        mkDesc(`Sicher bestellen — Details und Service bei ${host}.`),
      ];
    }
    if (base === "fr") {
      return [
        mkDesc(`${objHead(objF, 88)} En savoir plus sur ${host}.`),
        mkDesc(`Objectif : ${words(objF, 14)} Tout savoir sur la page officielle.`),
        mkDesc(`Achats sereins — informations complètes sur ${host}.`),
      ];
    }
    return [
      mkDesc(`${objHead(objF, 88)} Details at ${host}.`),
      mkDesc(`Goal: ${words(objF, 14)} Full story on the official site.`),
      mkDesc(`Shop with confidence — everything explained at ${host}.`),
    ];
  };

  let headlineSeeds: string[] = [];

  if (base === "pt") {
    headlineSeeds = [
      slug,
      `Descubra ${slug}`,
      `Experimente ${slug}`,
      words(offerF, 6),
      objHead(objF, H),
      `Compre ${slug} online`,
      `${words(offerF, 3)} · ${host}`,
      `Loja em ${host}`,
      `Melhor escolha: ${words(offerF, 3)}`,
      `Oferta: ${words(offerF, 4)}`,
      `${slug} — peça já`,
      `${words(offerF, 5)} hoje`,
      `Qualidade ${words(offerF, 2)}`,
      `Veja ${host} e decida`,
      `Pedido simples · ${host}`,
    ];
  } else if (base === "es") {
    headlineSeeds = [
      slug,
      `Prueba ${slug}`,
      `Descubre ${slug}`,
      words(offerF, 6),
      objHead(objF, H),
      `Compra ${slug} online`,
      `${words(offerF, 3)} · ${host}`,
      `Tienda en ${host}`,
      `Mejor oferta: ${words(offerF, 3)}`,
      `Oferta: ${words(offerF, 4)}`,
      `${slug} — pide ya`,
      `${words(offerF, 5)} hoy`,
      `Calidad ${words(offerF, 2)}`,
      `Mira ${host} y decide`,
      `Pedido fácil · ${host}`,
    ];
  } else if (base === "de") {
    headlineSeeds = [
      slug,
      `Entdecke ${slug}`,
      `Jetzt ${slug} testen`,
      words(offerF, 6),
      objHead(objF, H),
      `${slug} online kaufen`,
      `${words(offerF, 3)} · ${host}`,
      `Bei ${host} bestellen`,
      `Beste Wahl: ${words(offerF, 3)}`,
      `Angebot: ${words(offerF, 4)}`,
      `${slug} — jetzt sichern`,
      `${words(offerF, 5)} heute`,
      `Qualität: ${words(offerF, 2)}`,
      `${host} jetzt besuchen`,
      `Schnell bestellen · ${host}`,
    ];
  } else if (base === "fr") {
    headlineSeeds = [
      slug,
      `Découvrez ${slug}`,
      `Essayez ${slug}`,
      words(offerF, 6),
      objHead(objF, H),
      `Achetez ${slug} en ligne`,
      `${words(offerF, 3)} · ${host}`,
      `Sur ${host}`,
      `Meilleur choix : ${words(offerF, 3)}`,
      `Offre : ${words(offerF, 4)}`,
      `${slug} — commandez vite`,
      `${words(offerF, 5)} aujourd'hui`,
      `Qualité ${words(offerF, 2)}`,
      `Voir ${host} et choisir`,
      `Commande facile · ${host}`,
    ];
  } else {
    headlineSeeds = [
      slug,
      `Try ${slug}`,
      `Discover ${slug}`,
      words(offerF, 6),
      objHead(objF, H),
      `Buy ${slug} online`,
      `${words(offerF, 3)} · ${host}`,
      `Shop ${host}`,
      `Best choice: ${words(offerF, 3)}`,
      `Offer: ${words(offerF, 4)}`,
      `${slug} — order now`,
      `${words(offerF, 5)} today`,
      `Quality ${words(offerF, 2)}`,
      `See ${host} & decide`,
      `Easy order · ${host}`,
    ];
  }

  const [d2, d3, d4] = dRest();
  return {
    headlines: padTo12(headlineSeeds, offerF, slug),
    descriptions: [d1, d2, d3, d4],
  };
}
