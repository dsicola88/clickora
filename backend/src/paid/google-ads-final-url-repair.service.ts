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

export type FinalUrlRepairPlan =
  | { kind: "skip"; reason: string }
  | { kind: "error"; error: string }
  | { kind: "repair"; before: string; after: string; cleanedList: string[] };

function sameOriginAndPath(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname.replace(/\/+$/, "") === ub.pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
}

/**
 * Decide (sem efeitos) o que fazer com as Final URLs de um RSA.
 * Invariante: a reparação só remove gclid/ValueTrack da query — nunca muda domínio nem path
 * (a landing que o revisor do Google vê continua exactamente a mesma).
 */
export function planFinalUrlRepair(urls: string[]): FinalUrlRepairPlan {
  if (urls.length === 0) return { kind: "skip", reason: "sem_final_url" };
  const before = urls[0] ?? "";
  const issues: FinalUrlIssueCode[] = before ? inspectFinalUrl(before) : ["empty_final_url"];
  if (!issues.includes("final_url_has_click_id") && !issues.includes("final_url_has_valuetrack")) {
    return { kind: "skip", reason: "ja_limpa" };
  }
  const cleanedList = urls.map((u) => sanitizeFinalUrlForAds(u)).filter(Boolean);
  const after = cleanedList[0] ?? "";
  if (!after) return { kind: "skip", reason: "sanitize_falhou" };
  const afterIssues = inspectFinalUrl(after);
  if (afterIssues.includes("final_url_has_click_id") || afterIssues.includes("final_url_has_valuetrack")) {
    return {
      kind: "error",
      error:
        "A limpeza automática não removeu todo o ValueTrack/gclid (ex. no path). Em ads.google.com edite a Final URL para só a presell https://…/p/… e ponha macros no sufixo.",
    };
  }
  if (after === before) return { kind: "skip", reason: "sanitize_sem_efeito" };
  if (cleanedList.length !== urls.length || urls.some((u, i) => !sameOriginAndPath(u, cleanedList[i] ?? ""))) {
    return {
      kind: "error",
      error:
        "A limpeza mudaria o domínio ou o caminho da Final URL — nada foi alterado. Corrija manualmente em ads.google.com.",
    };
  }
  return { kind: "repair", before, after, cleanedList };
}

export async function repairGoogleFinalUrls(projectId: string, opts: { dryRun?: boolean } = {}) {
  const dryRun = opts.dryRun === true;
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
    const plan = planFinalUrlRepair(asStringArray(rsa.finalUrls));
    if (plan.kind === "skip") {
      skipped.push({ rsa_id: rsa.id, campaign_name: campaignName, reason: plan.reason });
      continue;
    }
    if (plan.kind === "error") {
      errors.push({ rsa_id: rsa.id, campaign_name: campaignName, error: plan.error });
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

    if (dryRun) {
      repaired.push({
        rsa_id: rsa.id,
        campaign_name: campaignName,
        before: plan.before,
        after: plan.after,
        applied_to_google: false,
      });
      continue;
    }

    const result = await applyGoogleUpdateRsaFinalUrls(projectId, {
      paid_ads_rsa_id: rsa.id,
      final_urls: plan.cleanedList,
    });

    console.info(
      "[finalUrlRepair]",
      JSON.stringify({ projectId, rsa_id: rsa.id, before: plan.before, after: plan.after, ok: result.ok }),
    );

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
      before: plan.before,
      after: plan.after,
      applied_to_google: true,
    });
  }

  const applied = repaired.filter((r) => r.applied_to_google).length;

  return {
    ok: true as const,
    dry_run: dryRun,
    repaired_count: repaired.length,
    applied_to_google_count: applied,
    skipped_count: skipped.length,
    error_count: errors.length,
    repaired,
    skipped,
    errors,
    note: dryRun
      ? "Pré-visualização: nada foi alterado na Google Ads. Confirme para aplicar."
      : applied > 0
        ? "Final URLs limpas e aplicadas na Google Ads. ValueTrack/UTMs dinâmicos devem ir no sufixo da URL em ads.google.com — não na Final URL."
        : "Nenhuma Final URL foi aplicada na Google Ads. Veja errors[] (falta sync/ID Google ou ValueTrack no path).",
  };
}
