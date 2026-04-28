/**
 * Gasto estimado campanha Meta (Graph insights) — USD.
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export async function fetchMetaCampaignSpendUsd(args: {
  accessToken: string;
  externalCampaignId: string | null;
}): Promise<{ ok: true; spendUsd: number } | { ok: false; error: string }> {
  const ext = args.externalCampaignId?.trim();
  if (!ext) return { ok: false, error: "Sem campanha Meta remota." };

  const u = new URL(`${GRAPH}/${ext.replace(/\D/g, "")}/insights`);
  u.searchParams.set("access_token", args.accessToken);
  u.searchParams.set("fields", "spend");
  u.searchParams.set("date_preset", "last_7d");

  const res = await fetch(u.toString());
  const j = (await res.json()) as {
    data?: Array<{ spend?: string }>;
    error?: { message?: string };
  };
  if (!res.ok || j.error) {
    return { ok: false, error: j.error?.message ?? `Meta insights ${res.status}` };
  }
  let total = 0;
  for (const row of j.data ?? []) {
    const n = Number(row.spend);
    if (Number.isFinite(n)) total += n;
  }
  return { ok: true, spendUsd: total };
}
