/** Escolhe um índice com a mesma proporção dos pesos. `randomUnit` está em [0, 1). */
export function pickWeightedIndex(weights: number[], randomUnit: number): number {
  const sum = weights.reduce((sum, weight) => sum + weight, 0);
  if (sum <= 0 || weights.length === 0) return 0;
  let cursor = randomUnit * sum;
  for (let i = 0; i < weights.length; i++) {
    cursor -= weights[i]!;
    if (cursor <= 0) return i;
  }
  return weights.length - 1;
}
