import type { ZodTypeAny, z } from "zod";

/**
 * Query de um hop pago (`/track/r/`, `/track/rot/`) nunca pode dar 400: o clique já foi pago.
 * Chaves repetidas (`gclid=a&gclid=a`) passam a 1.º valor; campos inválidos são descartados
 * em vez de rejeitar o pedido inteiro.
 */
export function parseLenientHopQuery<S extends ZodTypeAny>(
  schema: S,
  query: Record<string, unknown>,
): { data: z.infer<S>; dropped: string[] } {
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value.find((v) => typeof v === "string") : value;
    if (typeof first === "string") input[key] = first;
  }

  const dropped: string[] = [];
  for (let i = 0; i < 64; i += 1) {
    const parsed = schema.safeParse(input);
    if (parsed.success) return { data: parsed.data, dropped };
    const keys = new Set(
      parsed.error.issues.map((issue) => String(issue.path[0] ?? "")).filter((k) => k && k in input),
    );
    if (keys.size === 0) break;
    for (const key of keys) {
      delete input[key];
      dropped.push(key);
    }
  }
  return { data: schema.parse({}), dropped };
}
