/**
 * Remove ligações campaign ↔ asset para tipos de extensão geridos pelo Clickora,
 * antes de voltar a publicar sitelinks / callouts / structured snippets.
 */
import { runGoogleAdsMutate, runGoogleAdsSearch } from "./google-ads.api";

export async function removeGoogleCampaignExtensionAssetLinks(args: {
  accessToken: string;
  customerId: string;
  devToken: string;
  loginCustomerId?: string;
  /** ID numérico da campanha na conta Google */
  campaignNumericId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = args.campaignNumericId.replace(/\D/g, "");
  const q = `
    SELECT campaign_asset.resource_name
    FROM campaign_asset
    WHERE campaign.id = ${cid}
      AND campaign_asset.field_type IN ('SITELINK', 'CALLOUT', 'STRUCTURED_SNIPPET')
  `;
  const s = await runGoogleAdsSearch(
    args.accessToken,
    args.customerId,
    args.devToken,
    q,
    args.loginCustomerId,
  );
  if (s.error?.message) {
    return { ok: false, error: s.error.message };
  }
  const rns: string[] = [];
  for (const row of s.results ?? []) {
    const o = row as Record<string, unknown>;
    const ca = o.campaignAsset as { resourceName?: string } | undefined;
    const rn = ca?.resourceName ?? (o.resourceName as string | undefined);
    if (rn) rns.push(rn);
  }
  const BATCH = 40;
  for (let i = 0; i < rns.length; i += BATCH) {
    const slice = rns.slice(i, i + BATCH);
    const m = await runGoogleAdsMutate(
      args.accessToken,
      args.customerId,
      args.devToken,
      "campaignAssets",
      { operations: slice.map((resourceName) => ({ remove: resourceName })) },
      args.loginCustomerId,
    );
    if (m.error?.message) {
      return { ok: false, error: m.error.message };
    }
  }
  return { ok: true };
}
