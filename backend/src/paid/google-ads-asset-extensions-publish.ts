/**
 * Cria Assets (sitelinks, callouts, snippet) e liga-os à campanha via campaignAssets.
 */

import type { GoogleCampaignAssetExtensionsStored, GoogleStructuredSnippetHeader } from "./google-campaign-asset-extensions";

/** Lê extensões já finalizadas em `bidding_config.google_asset_extensions`. */
export function readGoogleAssetExtensionsFromBidding(biddingConfig: unknown): GoogleCampaignAssetExtensionsStored | null {
  if (!biddingConfig || typeof biddingConfig !== "object" || Array.isArray(biddingConfig)) return null;
  const raw = (biddingConfig as Record<string, unknown>).google_asset_extensions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const sitelinks = (raw as { sitelinks?: unknown }).sitelinks;
  const callouts = (raw as { callouts?: unknown }).callouts;
  if (!Array.isArray(callouts)) return null;
  if (!Array.isArray(sitelinks) || sitelinks.length === 0) return null;

  const mappedSitelinks = sitelinks
    .map((s: unknown) => {
      const o = s as Record<string, unknown>;
      const link_text = String(o.link_text ?? "").trim();
      const final_url = String(o.final_url ?? "").trim();
      if (!link_text || !final_url) return null;
      return {
        link_text,
        final_url,
        ...(o.description1 ? { description1: String(o.description1) } : {}),
        ...(o.description2 ? { description2: String(o.description2) } : {}),
      };
    })
    .filter(Boolean) as GoogleCampaignAssetExtensionsStored["sitelinks"];

  let structured_snippet: GoogleCampaignAssetExtensionsStored["structured_snippet"] = null;
  const st = (raw as { structured_snippet?: unknown }).structured_snippet;
  if (st && typeof st === "object" && !Array.isArray(st)) {
    const hdr = (st as { header?: unknown }).header;
    const vals = (st as { values?: unknown }).values;
    if (typeof hdr === "string" && Array.isArray(vals)) {
      const vv = vals.map((v) => String(v)).filter((v) => v.trim());
      if (vv.length >= 3) {
        structured_snippet = {
          header: hdr as GoogleStructuredSnippetHeader,
          values: vv,
        };
      }
    }
  }

  if (mappedSitelinks.length < 2) return null;

  return {
    sitelinks: mappedSitelinks,
    callouts: callouts.map((c) => String(c).trim()).filter(Boolean),
    structured_snippet,
  };
}

export type MutateFn = (
  accessToken: string,
  devToken: string,
  customerId: string,
  servicePath: string,
  body: object,
  loginCustomerId?: string,
) => Promise<{ resourceNames: string[] }>;

/**
 * Liga assets de texto à campanha na ordem esperada pela API (criação síncrona ↔ resourceNames).
 */
export async function publishGoogleCampaignAssetExtensions(args: {
  mutate: MutateFn;
  accessToken: string;
  devToken: string;
  customerId: string;
  loginCustomerId?: string;
  campaignResourceName: string;
  extensions: GoogleCampaignAssetExtensionsStored;
}): Promise<void> {
  const operations: { create: Record<string, unknown> }[] = [];

  for (const s of args.extensions.sitelinks) {
    const sitelinkAsset: Record<string, unknown> = {
      linkText: s.link_text.slice(0, 25),
    };
    /** Sitelink: description1 e description2 são *par* — a Google rejeita se vier só uma. */
    const d1 = (s.description1 ?? "").trim();
    const d2 = (s.description2 ?? "").trim();
    if (d1 && d2) {
      sitelinkAsset.description1 = d1.slice(0, 35);
      sitelinkAsset.description2 = d2.slice(0, 35);
    }
    operations.push({
      create: {
        finalUrls: [s.final_url],
        sitelinkAsset,
      },
    });
  }

  const calloutTexts = args.extensions.callouts.map((c) => c.trim().slice(0, 25)).filter(Boolean);
  for (const t of calloutTexts) {
    operations.push({
      create: {
        calloutAsset: { calloutText: t },
      },
    });
  }

  const sn = args.extensions.structured_snippet;
  let snippetQueued = false;
  if (sn?.values?.length) {
    const vals = sn.values.filter(Boolean).slice(0, 10);
    if (vals.length >= 3) {
      snippetQueued = true;
      operations.push({
        create: {
          structuredSnippetAsset: {
            header: sn.header,
            values: vals,
          },
        },
      });
    }
  }

  if (operations.length === 0) return;

  const { resourceNames: assetRns } = await args.mutate(
    args.accessToken,
    args.devToken,
    args.customerId,
    "assets",
    { operations },
    args.loginCustomerId,
  );

  const campaignRn = args.campaignResourceName;
  const linkOps: { create: Record<string, unknown> }[] = [];
  let i = 0;

  for (let k = 0; k < args.extensions.sitelinks.length; k++) {
    const rn = assetRns[i++];
    if (!rn) break;
    linkOps.push({
      create: { campaign: campaignRn, asset: rn, fieldType: "SITELINK" },
    });
  }
  for (let k = 0; k < calloutTexts.length; k++) {
    const rn = assetRns[i++];
    if (!rn) break;
    linkOps.push({
      create: { campaign: campaignRn, asset: rn, fieldType: "CALLOUT" },
    });
  }
  if (snippetQueued) {
    const rn = assetRns[i++];
    if (rn) {
      linkOps.push({
        create: { campaign: campaignRn, asset: rn, fieldType: "STRUCTURED_SNIPPET" },
      });
    }
  }

  if (linkOps.length) {
    await args.mutate(
      args.accessToken,
      args.devToken,
      args.customerId,
      "campaignAssets",
      { operations: linkOps },
      args.loginCustomerId,
    );
  }
}
