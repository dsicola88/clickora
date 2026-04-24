import type { Request } from "express";
import { z } from "zod";

function firstQueryVal(query: Request["query"], key: string): string | undefined {
  const v = query[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  return undefined;
}

/**
 * Parâmetros frequentes em trackers tipo Voluum (campanha → lander) para segmentação e custo.
 * Valores são gravados em metadata do evento; não confundir com o UUID do clique gerado pelo dclickora.
 */
export const voluumStyleQuerySchema = z.object({
  cost: z.string().max(64).optional(),
  externalid: z.string().max(512).optional(),
  /** Click ID do tracker a montante (ex.: visita na campanha Voluum antes da presell). */
  clickid: z.string().max(512).optional(),
  cid: z.string().max(512).optional(),
  var1: z.string().max(512).optional(),
  var2: z.string().max(512).optional(),
  var3: z.string().max(512).optional(),
  var4: z.string().max(512).optional(),
  var5: z.string().max(512).optional(),
  var6: z.string().max(512).optional(),
  var7: z.string().max(512).optional(),
  var8: z.string().max(512).optional(),
  var9: z.string().max(512).optional(),
  var10: z.string().max(512).optional(),
});

export type VoluumStyleQuery = z.infer<typeof voluumStyleQuerySchema>;

export function voluumStyleMetadata(q: VoluumStyleQuery): Record<string, string> {
  const out: Record<string, string> = {};
  const cost = q.cost?.trim();
  if (cost) out.traffic_cost = cost;
  const externalid = q.externalid?.trim();
  if (externalid) out.traffic_external_id = externalid;
  const upClickid = q.clickid?.trim();
  if (upClickid) out.upstream_clickid = upClickid;
  const upCid = q.cid?.trim();
  if (upCid) out.upstream_cid = upCid;
  for (let i = 1; i <= 10; i++) {
    const k = `var${i}` as keyof VoluumStyleQuery;
    const v = q[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

/** Query do pixel GET (mesmos nomes que no redirect). */
export function voluumStyleMetadataFromExpressQuery(query: Request["query"]): Record<string, string> {
  return voluumStyleMetadata({
    cost: firstQueryVal(query, "cost"),
    externalid: firstQueryVal(query, "externalid"),
    clickid: firstQueryVal(query, "clickid"),
    cid: firstQueryVal(query, "cid"),
    var1: firstQueryVal(query, "var1"),
    var2: firstQueryVal(query, "var2"),
    var3: firstQueryVal(query, "var3"),
    var4: firstQueryVal(query, "var4"),
    var5: firstQueryVal(query, "var5"),
    var6: firstQueryVal(query, "var6"),
    var7: firstQueryVal(query, "var7"),
    var8: firstQueryVal(query, "var8"),
    var9: firstQueryVal(query, "var9"),
    var10: firstQueryVal(query, "var10"),
  });
}
