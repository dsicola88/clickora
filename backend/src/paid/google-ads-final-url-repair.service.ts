/**
 * Repara Final URLs RSA: strip gclid/ValueTrack e aplica na Google (mutate) + local.
 * Só conta como reparado se a mutação na Google Ads tiver sucesso.
 * Não cria inventário; só limpa URLs de RSAs já importadas/publicadas.
 */
import {
  inspectFinalUrl,
  sanitizeFinalUrlForAds,
  type FinalUrlIssueCode,
} from "../lib/googleAdsFinalUrl";
import { applyGoogleUpdateRsaFinalUrls } from "./google-ads.mutations";
import { prisma } from "./paidPrisma";

function asStringArray(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export async function repairGoogleFinalUrls(projectId: string) {
  const rsas = await prisma.paidAdsRsa.findMany({
    where: {
      status: { not: "archived" },
      adGroup: { campaign: { projectId, platform: "google_ads", status: { not: "archived" } } },
    },
    select: {
      id: true,
      finalUrls: true,
      externalAdId: true,
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

    const cleanedList = urls.map((u) => sanitizeFinalUrlForAds(u)).filter(Boolean);
    const after = cleanedList[0] ?? null;
    if (!after) {
      skipped.push({
        rsa_id: rsa.id,
        campaign_name: campaignName,
        reason: "sanitize_falhou",
      });
      continue;
    }

    const afterIssues = inspectFinalUrl(after);
    if (
      afterIssues.includes("final_url_has_click_id") ||
      afterIssues.includes("final_url_has_valuetrack")
    ) {
      errors.push({
        rsa_id: rsa.id,
        campaign_name: campaignName,
        error:
          "A limpeza automática não removeu todo o ValueTrack/gclid (ex. no path). Em ads.google.com edite a Final URL para só a presell https://…/p/… e ponha macros no sufixo.",
      });
      continue;
    }

    if (after === before) {
      skipped.push({
        rsa_id: rsa.id,
        campaign_name: campaignName,
        reason: "sanitize_sem_efeito",
      });
      continue;
    }

    if (!rsa.externalAdId || !rsa.adGroup.externalAdGroupId) {
      errors.push({
        rsa_id: rsa.id,
        campaign_name: campaignName,
        error:
          "Anúncio sem ID Google — sincronize/importe a campanha da rede e volte a Reparar. Sem isto a Final URL na Google Ads não muda.",
      });
      continue;
    }

    const result = await applyGoogleUpdateRsaFinalUrls(projectId, {
      paid_ads_rsa_id: rsa.id,
      final_urls: cleanedList,
    });

    if (!result.ok) {
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
      applied_to_google: true,
    });
  }

  const applied = repaired.filter((r) => r.applied_to_google).length;

  return {
    ok: true as const,
    repaired_count: repaired.length,
    applied_to_google_count: applied,
    skipped_count: skipped.length,
    error_count: errors.length,
    repaired,
    skipped,
    errors,
    note:
      applied > 0
        ? "Final URLs limpas e aplicadas na Google Ads. ValueTrack/UTMs dinâmicos devem ir no sufixo da URL em ads.google.com — não na Final URL."
        : "Nenhuma Final URL foi aplicada na Google Ads. Veja errors[] (falta sync/ID Google ou ValueTrack no path).",
  };
}
