/**
 * Repara Final URLs RSA: strip gclid/ValueTrack e aplica na Google (mutate) + local.
 * Não cria inventário; só limpa URLs de RSAs já importadas/publicadas.
 */
import {
  inspectFinalUrl,
  sanitizeFinalUrlForAds,
  type FinalUrlIssueCode,
} from "../lib/googleAdsFinalUrl";
import { applyGoogleUpdateRsaCopy } from "./google-ads.mutations";
import { prisma } from "./paidPrisma";

function asStringArray(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function asHeadlineTexts(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j
    .map((x) => {
      if (typeof x === "string") return x.trim();
      if (x && typeof x === "object" && "text" in x) return String((x as { text?: string }).text ?? "").trim();
      return "";
    })
    .filter(Boolean);
}

export async function repairGoogleFinalUrls(projectId: string) {
  const rsas = await prisma.paidAdsRsa.findMany({
    where: {
      status: { not: "archived" },
      adGroup: { campaign: { projectId, platform: "google_ads", status: { not: "archived" } } },
    },
    select: {
      id: true,
      headlines: true,
      descriptions: true,
      finalUrls: true,
      externalAdId: true,
      displayPath1: true,
      displayPath2: true,
      adGroup: {
        select: {
          id: true,
          externalAdGroupId: true,
          campaign: { select: { id: true, name: true, externalCampaignId: true } },
        },
      },
    },
    take: 200,
  });

  const repaired: Array<{
    rsa_id: string;
    campaign_name: string;
    before: string | null;
    after: string | null;
    applied_to_google: boolean;
  }> = [];
  const skipped: Array<{ rsa_id: string; campaign_name: string; reason: string }> = [];
  const errors: Array<{ rsa_id: string; campaign_name: string; error: string }> = [];

  for (const rsa of rsas) {
    const campaignName = rsa.adGroup.campaign.name;
    const urls = asStringArray(rsa.finalUrls);
    if (urls.length === 0) {
      skipped.push({ rsa_id: rsa.id, campaign_name: campaignName, reason: "sem_final_url" });
      continue;
    }

    const before = urls[0] ?? null;
    const issues: FinalUrlIssueCode[] = before ? inspectFinalUrl(before) : ["empty_final_url"];
    const needs =
      issues.includes("final_url_has_click_id") || issues.includes("final_url_has_valuetrack");
    if (!needs) {
      skipped.push({ rsa_id: rsa.id, campaign_name: campaignName, reason: "ja_limpa" });
      continue;
    }

    const cleanedList = urls
      .map((u) => sanitizeFinalUrlForAds(u))
      .filter(Boolean);
    const after = cleanedList[0] ?? null;
    if (!after || after === before) {
      skipped.push({
        rsa_id: rsa.id,
        campaign_name: campaignName,
        reason: after ? "sanitize_sem_efeito" : "sanitize_falhou",
      });
      continue;
    }

    const headlines = asHeadlineTexts(rsa.headlines);
    const descriptions = asHeadlineTexts(rsa.descriptions);
    if (headlines.length < 3 || descriptions.length < 2) {
      skipped.push({
        rsa_id: rsa.id,
        campaign_name: campaignName,
        reason: "rsa_sem_copy_minima",
      });
      continue;
    }

    const result = await applyGoogleUpdateRsaCopy(projectId, {
      paid_ads_rsa_id: rsa.id,
      headlines,
      descriptions,
      final_urls: cleanedList,
      path1: rsa.displayPath1 ?? undefined,
      path2: rsa.displayPath2 ?? undefined,
    });

    if (!result.ok) {
      // applyGoogleUpdateRsaCopy grava local antes do mutate Google — reverte se falhou.
      try {
        await prisma.paidAdsRsa.update({
          where: { id: rsa.id },
          data: { finalUrls: urls },
        });
      } catch {
        /* ignore revert failure; erro Google já reportado */
      }
      errors.push({
        rsa_id: rsa.id,
        campaign_name: campaignName,
        error: result.error,
      });
      continue;
    }

    repaired.push({
      rsa_id: rsa.id,
      campaign_name: campaignName,
      before,
      after,
      applied_to_google: Boolean(rsa.externalAdId && rsa.adGroup.externalAdGroupId),
    });
  }

  return {
    ok: true as const,
    repaired_count: repaired.length,
    skipped_count: skipped.length,
    error_count: errors.length,
    repaired,
    skipped,
    errors,
    note:
      "Removeu gclid/ValueTrack das Final URLs. ValueTrack deve ir no sufixo em ads.google.com. Re-sincronizar após reparo se quiser confirmar o inventário.",
  };
}
