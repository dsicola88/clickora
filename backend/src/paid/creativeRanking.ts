/**
 * Ranking de variantes publicadas — CTR / conversões / cliques.
 * Não inventa métricas: só ordena o que a rede (ou telemetria) devolveu.
 */

export type CreativeVariantMetrics = {
  id: string;
  label: string;
  external_id: string | null;
  impressions: number;
  clicks: number;
  spend_usd: number;
  conversions: number;
  /** CTR 0–1; null se impressões = 0. */
  ctr: number | null;
};

export type CreativeRankingResult = {
  ranked: Array<
    CreativeVariantMetrics & {
      rank: number;
      score: number;
    }
  >;
  winner_id: string | null;
  loser_id: string | null;
  /** Imp. mínimas para considerar um anúncio no ranking de vencedor/perdedor. */
  min_impressions: number;
  note: string;
};

/** Score: CTR (peso) + conversões + log1p(clicks). Só variantes com impressões ≥ min. */
export function rankCreativeVariants(
  rows: CreativeVariantMetrics[],
  opts?: { minImpressions?: number },
): CreativeRankingResult {
  const min_impressions = opts?.minImpressions ?? 100;
  const eligible = rows.filter((r) => r.impressions >= min_impressions);
  const scored = eligible.map((r) => {
    const ctr = r.ctr != null ? r.ctr : r.impressions > 0 ? r.clicks / r.impressions : 0;
    const score = ctr * 1000 + r.conversions * 10 + Math.log1p(r.clicks);
    return { ...r, ctr, score };
  });
  scored.sort((a, b) => b.score - a.score || b.conversions - a.conversions || b.clicks - a.clicks);

  const ranked = scored.map((r, i) => ({ ...r, rank: i + 1 }));
  const winner_id = ranked[0]?.id ?? null;
  const loser_id =
    ranked.length >= 2 ? ranked[ranked.length - 1]!.id : null;

  let note: string;
  if (rows.length === 0) {
    note = "Sem anúncios/criativos publicados com métricas.";
  } else if (eligible.length === 0) {
    note = `Nenhuma variante atingiu ${min_impressions} impressões — ranking adiado.`;
  } else if (ranked.length === 1) {
    note = "Só há uma variante elegível — sem perdedor comparável.";
  } else {
    note = `Vencedor vs perdedor por CTR/conversões (≥ ${min_impressions} imp.).`;
  }

  return { ranked, winner_id, loser_id, min_impressions, note };
}
