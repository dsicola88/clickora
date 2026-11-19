/**
 * Auditoria read-only de Final URLs RSA (local) — sintoma clássico «Ads ≠ Clickora».
 * Sem cloaking: só parsing de URL vs regras de Final URL limpa.
 */
import {
  hostFromUrl,
  inspectFinalUrlList,
  issueLabelPt,
  type FinalUrlIssueCode,
} from "../lib/googleAdsFinalUrl";
import { prisma } from "./paidPrisma";

function asStringArray(j: unknown): string[] {
  if (!Array.isArray(j)) return [];
  return j.map((x) => String(x ?? "").trim()).filter(Boolean);
}

export async function auditGoogleFinalUrls(projectId: string) {
  const project = await prisma.paidAdsProject.findUnique({
    where: { id: projectId },
    select: { websiteUrl: true },
  });
  if (!project) {
    return { ok: false as const, error: "Projecto não encontrado.", code: "not_found" };
  }

  const expectedHost = hostFromUrl(project.websiteUrl);
  const campaigns = await prisma.paidAdsCampaign.findMany({
    where: { projectId, platform: "google_ads", status: { not: "archived" } },
    select: {
      id: true,
      name: true,
      status: true,
      externalCampaignId: true,
      adGroups: {
        select: {
          id: true,
          name: true,
          adsRsa: {
            where: { status: { not: "archived" } },
            select: { id: true, status: true, finalUrls: true, externalAdId: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 120,
  });

  const rows: Array<{
    campaign_id: string;
    campaign_name: string;
    local_status: string;
    external_campaign_id: string | null;
    ads_checked: number;
    sample_url: string | null;
    hosts: string[];
    multiple_distinct_hosts: boolean;
    issues: FinalUrlIssueCode[];
    issue_labels: string[];
    severity: "ok" | "warn" | "critical";
  }> = [];

  for (const c of campaigns) {
    const urls = c.adGroups.flatMap((ag) => ag.adsRsa.flatMap((ad) => asStringArray(ad.finalUrls)));
    const adsChecked = c.adGroups.reduce((n, ag) => n + ag.adsRsa.length, 0);
    const inspected = inspectFinalUrlList(urls, expectedHost);
    const issues = [...inspected.issues];
    if (inspected.multiple_distinct_hosts) {
      // marcador lógico — não está no enum de URL única; representamos via labels
    }
    const issue_labels = [
      ...issues.map(issueLabelPt),
      ...(inspected.multiple_distinct_hosts ? ["Vários hosts nas RSAs da campanha"] : []),
    ];
    const hasCritical =
      issues.includes("final_url_has_click_id") ||
      issues.includes("final_url_has_valuetrack") ||
      issues.includes("empty_final_url");
    const hasWarn =
      issues.includes("host_mismatch") ||
      issues.includes("not_https") ||
      issues.includes("invalid_url") ||
      inspected.multiple_distinct_hosts;
    rows.push({
      campaign_id: c.id,
      campaign_name: c.name,
      local_status: c.status,
      external_campaign_id: c.externalCampaignId?.replace(/\D/g, "") || null,
      ads_checked: adsChecked,
      sample_url: inspected.sample_url,
      hosts: inspected.hosts,
      multiple_distinct_hosts: inspected.multiple_distinct_hosts,
      issues,
      issue_labels,
      severity: hasCritical ? "critical" : hasWarn ? "warn" : adsChecked === 0 ? "warn" : "ok",
    });
  }

  // Campanhas sem RSA → aviso
  for (const r of rows) {
    if (r.ads_checked === 0 && r.issue_labels.length === 0) {
      r.issue_labels.push("Sem RSA local — importe ou publique a estrutura");
      r.severity = "warn";
      r.issues = ["empty_final_url"];
    }
  }

  const totals = {
    campaigns: rows.length,
    ok: rows.filter((r) => r.severity === "ok").length,
    warn: rows.filter((r) => r.severity === "warn").length,
    critical: rows.filter((r) => r.severity === "critical").length,
  };

  return {
    ok: true as const,
    expected_host: expectedHost,
    website_url: project.websiteUrl,
    source: "local_inventory" as const,
    note:
      "Auditoria sobre RSAs guardadas na Dclickora (criação/import). Não altera HTML nem cloaka a landing.",
    campaigns: rows,
    totals,
  };
}
