import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { GoogleAdsStudioRsaCreativeBlock } from "@/components/dpilot/GoogleAdsStudioRsaCreativeBlock";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Textarea } from "@/components/ui/textarea";
import {
  campaignStatusLabel,
  formatUsdFromMicros,
  googleBiddingSummaryLinesFromPayload,
  googleStudioBiddingFormDefaultsFromCampaign,
  publishedBidStrategyHint,
  type GoogleStudioBiddingStrategyKey,
} from "@/lib/paidAdsUi";
import type {
  CampaignRow,
  GoogleCampaignAssetExtensionsDto,
  GoogleCampaignStudioDto,
  GoogleStudioAdGroupRow,
} from "@/services/paidAdsService";
import { paidAdsService } from "@/services/paidAdsService";
import { cn } from "@/lib/utils";
import { useViewportMinWidth, VIEWPORT_LG_MIN_PX } from "@/hooks/useViewportMinWidth";
import { ExternalLink, ChevronDown, Loader2 } from "lucide-react";
import { Gate } from "./DpilotPaidPages";
import { UUID_RE, useDpilotPaid } from "./DpilotPaidContext";
import { StudioSettingsPanel, StudioSettingsRow } from "./dpilotGoogleStudioSettingsUi";
import { GoogleAdsRsaDraftPreview } from "./DpilotGoogleSearchAdPreview";

type MatchSel = "exact" | "phrase" | "broad";

type StudioSnippetHeader = "Brands" | "Services" | "Types" | "Models" | "Destinations";

const STUDIO_SNIPPET_HEADERS: StudioSnippetHeader[] = [
  "Brands",
  "Services",
  "Types",
  "Models",
  "Destinations",
];

type StudioSection = "visao" | "conteudos" | "negativas_extensoes" | "leiloes" | "controlo" | "insights";

function isoRangeDefaultLast14(): { from: string; to: string } {
  const to = new Date();
  const utcMid = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const from = new Date(utcMid);
  from.setUTCDate(from.getUTCDate() - 13);
  return { from: from.toISOString().slice(0, 10), to: utcMid.toISOString().slice(0, 10) };
}

function firstLanguageCode(c: CampaignRow): string {
  const raw = (c as { language_targets?: unknown }).language_targets;
  if (!Array.isArray(raw) || raw.length === 0) return "pt";
  const s = String(raw[0]).trim().toLowerCase();
  return s.slice(0, 16) || "pt";
}

function firstCountryIso(c: CampaignRow): string {
  const g = c.geo_targets;
  if (!Array.isArray(g) || g.length === 0) return "PT";
  return String(g[0]).trim().slice(0, 2).toUpperCase() || "PT";
}

function isManualCpc(bidding: Record<string, unknown> | undefined): boolean {
  const g = bidding?.google;
  if (!g || typeof g !== "object") return false;
  return (g as { strategy?: string }).strategy === "manual_cpc";
}

function matchTypeLabel(m: MatchSel): string {
  if (m === "broad") return "Ampla";
  if (m === "exact") return "Exacta";
  return "Expressão";
}

function linesToNegKeywords(
  text: string,
  match: MatchSel,
): Array<{ text: string; match_type: MatchSel }> {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t) => t.slice(0, 80));
  const seen = new Set<string>();
  const out: Array<{ text: string; match_type: MatchSel }> = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: line, match_type: match });
  }
  return out;
}

function parseSitelinkLines(
  text: string,
): Array<{ link_text: string; final_url: string }> {
  const out: Array<{ link_text: string; final_url: string }> = [];
  for (const line of text.split("\n")) {
    const raw = line.trim();
    if (!raw) continue;
    const pipe = raw.indexOf("|");
    if (pipe <= 0) continue;
    const link_text = raw.slice(0, pipe).trim().slice(0, 25);
    const final_url = raw.slice(pipe + 1).trim();
    if (!link_text || !/^https:\/\//i.test(final_url)) continue;
    out.push({ link_text, final_url });
    if (out.length >= 20) break;
  }
  return out;
}

function buildGoogleAssetExtensionsPayload(
  extCalloutsText: string,
  extSitelinksText: string,
  extSnippetHeader: StudioSnippetHeader,
  extSnippetValuesText: string,
): Record<string, unknown> {
  const callouts = extCalloutsText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((c) => c.slice(0, 25))
    .slice(0, 10);
  const sitelinks = parseSitelinkLines(extSitelinksText);
  const valLines = extSnippetValuesText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((v) => v.slice(0, 25));
  const obj: Record<string, unknown> = {};
  if (callouts.length) obj.callouts = callouts;
  if (sitelinks.length >= 2) obj.sitelinks = sitelinks;
  if (valLines.length >= 3) {
    obj.structured_snippet = { header: extSnippetHeader, values: valLines.slice(0, 10) };
  }
  return obj;
}

function extensionsDraftFromDto(ae: GoogleCampaignAssetExtensionsDto | null): {
  extCalloutsText: string;
  extSitelinksText: string;
  extSnippetHeader: StudioSnippetHeader;
  extSnippetValuesText: string;
} {
  if (!ae) {
    return {
      extCalloutsText: "",
      extSitelinksText: "",
      extSnippetHeader: "Services",
      extSnippetValuesText: "",
    };
  }
  const hdrRaw = ae.structured_snippet?.header?.trim() ?? "";
  const extSnippetHeader = STUDIO_SNIPPET_HEADERS.includes(hdrRaw as StudioSnippetHeader)
    ? (hdrRaw as StudioSnippetHeader)
    : "Services";
  return {
    extCalloutsText: ae.callouts.join("\n"),
    extSitelinksText: ae.sitelinks.map((s) => `${s.link_text} | ${s.final_url}`).join("\n"),
    extSnippetHeader,
    extSnippetValuesText: (ae.structured_snippet?.values ?? []).join("\n"),
  };
}

function geoLangSummaryLine(campaign: CampaignRow & { language_targets?: string[] }): string {
  const g =
    Array.isArray(campaign.geo_targets) && campaign.geo_targets.length
      ? campaign.geo_targets.join(", ")
      : "—";
  const lt = campaign.language_targets;
  const langs =
    Array.isArray(lt) && lt.length
      ? lt.map((x) => String(x).trim()).filter(Boolean).join(", ")
      : firstLanguageCode(campaign);
  return `${g} · idiomas: ${langs}`;
}

function countNonEmptyLines(s: string): number {
  return s.split("\n").map((l) => l.trim()).filter(Boolean).length;
}

/** Palavras‑chave (rascunho: textarea) deduplicadas para chips de inclusão nos títulos. */
function keywordHintsFromDraftLines(text: string): { text: string }[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 48);
  const seen = new Set<string>();
  const out: { text: string }[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: line });
  }
  return out;
}

function googleBiddingStrategyShort(campaign: CampaignRow): string {
  const lines = googleBiddingSummaryLinesFromPayload(campaign as unknown as Record<string, unknown>);
  const first = lines[0];
  if (!first) return "Definida na criação do plano (detalhe indisponível neste resumo).";
  return first.replace(/^Estratégia de licitação \(Google\):\s*/, "").trim();
}

function BadgeEntityStatus({ s }: { s: string }) {
  return (
    <Badge variant="outline" className="font-normal text-[10px]">
      {s}
    </Badge>
  );
}

export function DpilotGoogleCampaignStudioPage() {
  const { projectId, campaignId } = useParams();
  const { overview, reload: reloadPaid } = useDpilotPaid();
  const lgLayout = useViewportMinWidth(VIEWPORT_LG_MIN_PX);

  const ok =
    projectId &&
    campaignId &&
    UUID_RE.test(projectId) &&
    UUID_RE.test(campaignId);

  const [studio, setStudio] = useState<GoogleCampaignStudioDto | null>(null);
  const [loading, setLoading] = useState(true);

  /** Rascunho: keywords por grupo (textarea, uma linha = uma palavra). */
  const [draftKwText, setDraftKwText] = useState<Record<string, string>>({});
  const [draftKwMatch, setDraftKwMatch] = useState<Record<string, MatchSel>>({});
  const [draftRsaH, setDraftRsaH] = useState<Record<string, string>>({});
  const [draftRsaD, setDraftRsaD] = useState<Record<string, string>>({});
  const [draftRsaFinalUrl, setDraftRsaFinalUrl] = useState<Record<string, string>>({});
  const [draftRsaPath1, setDraftRsaPath1] = useState<Record<string, string>>({});
  const [draftRsaPath2, setDraftRsaPath2] = useState<Record<string, string>>({});

  const [budgetUsd, setBudgetUsd] = useState("");
  const [campaignIdentityName, setCampaignIdentityName] = useState("");
  const [campaignObjectiveDraft, setCampaignObjectiveDraft] = useState("");
  const [bidStrategy, setBidStrategy] = useState<GoogleStudioBiddingStrategyKey>("maximize_conversions");
  const [bidCpaUsd, setBidCpaUsd] = useState("");
  const [bidRoas, setBidRoas] = useState("");
  const [bidMaxCpcUsd, setBidMaxCpcUsd] = useState("");
  const [perfFrom, setPerfFrom] = useState(() => isoRangeDefaultLast14().from);
  const [perfTo, setPerfTo] = useState(() => isoRangeDefaultLast14().to);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfErr, setPerfErr] = useState<string | null>(null);
  const [perfRows, setPerfRows] = useState<
    Array<{ date: string; impressions: number; clicks: number; cost_micros: number; conversions: number }>
  >([]);
  const [perfTotals, setPerfTotals] = useState<{
    impressions: number;
    clicks: number;
    cost_micros: number;
    conversions: number;
  } | null>(null);
  /** Ao vivo por grupo — acrescentar palavras. */
  const [liveAddText, setLiveAddText] = useState<Record<string, string>>({});
  const [liveAddMatch, setLiveAddMatch] = useState<Record<string, MatchSel>>({});

  const [draftCampaignNegText, setDraftCampaignNegText] = useState("");
  const [draftCampaignNegMatch, setDraftCampaignNegMatch] = useState<MatchSel>("phrase");
  const [draftAgNegText, setDraftAgNegText] = useState<Record<string, string>>({});
  const [draftAgNegMatch, setDraftAgNegMatch] = useState<Record<string, MatchSel>>({});
  const [extCalloutsText, setExtCalloutsText] = useState("");
  const [extSitelinksText, setExtSitelinksText] = useState("");
  const [extSnippetHeader, setExtSnippetHeader] = useState<StudioSnippetHeader>("Services");
  const [extSnippetValuesText, setExtSnippetValuesText] = useState("");

  /** Insights */
  const [insightKw, setInsightKw] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightResult, setInsightResult] = useState<Record<string, unknown> | null>(null);

  const [studioSection, setStudioSection] = useState<StudioSection>("visao");

  /** Grupo cuja RSA alimenta o painel direito (estilo Google Ads). */
  const [previewAgId, setPreviewAgId] = useState<string | null>(null);

  const isAutopilot = overview?.project?.paid_mode === "autopilot";

  const loadStudio = useCallback(async () => {
    if (!ok) return;
    setLoading(true);
    const { data, error } = await paidAdsService.getGoogleCampaignStudio(projectId, campaignId);
    setLoading(false);
    if (error || !data) {
      toast.error(error || "Não foi possível carregar o estúdio.");
      setStudio(null);
      return;
    }
    setStudio(data);
    const nextKw: Record<string, string> = {};
    const nextM: Record<string, MatchSel> = {};
    const h: Record<string, string> = {};
    const d: Record<string, string> = {};
    const fu: Record<string, string> = {};
    const p1: Record<string, string> = {};
    const p2: Record<string, string> = {};
    for (const ag of data.ad_groups) {
      nextKw[ag.id] = ag.keywords.map((k) => k.text).join("\n");
      nextM[ag.id] = "phrase";
      const rsa0 = ag.rsa[0];
      if (rsa0) {
        h[ag.id] = rsa0.headlines.join("\n");
        d[ag.id] = rsa0.descriptions.join("\n");
        fu[ag.id] = rsa0.final_urls?.[0] ?? "";
        p1[ag.id] = rsa0.path1 ?? "";
        p2[ag.id] = rsa0.path2 ?? "";
      } else {
        h[ag.id] = "";
        d[ag.id] = "";
        fu[ag.id] = "";
        p1[ag.id] = "";
        p2[ag.id] = "";
      }
    }
    setDraftKwText(nextKw);
    setDraftKwMatch(nextM);
    setDraftRsaH(h);
    setDraftRsaD(d);
    setDraftRsaFinalUrl(fu);
    setDraftRsaPath1(p1);
    setDraftRsaPath2(p2);

    setCampaignIdentityName(data.campaign.name ?? "");
    setCampaignObjectiveDraft(
      ((data.campaign as { objective_summary?: string | null }).objective_summary ?? "").trim(),
    );
    const bids = googleStudioBiddingFormDefaultsFromCampaign(data.campaign as unknown as Record<string, unknown>);
    setBidStrategy(bids.strategy);
    setBidCpaUsd(bids.targetCpaUsd);
    setBidRoas(bids.targetRoas);
    setBidMaxCpcUsd(bids.maxCpcUsd);

    const cur = data.campaign.daily_budget_micros;
    setBudgetUsd(
      typeof cur === "number" && Number.isFinite(cur) ? (cur / 1_000_000).toFixed(2) : "",
    );

    const la: Record<string, string> = {};
    const lm: Record<string, MatchSel> = {};
    for (const ag of data.ad_groups) {
      la[ag.id] = "";
      lm[ag.id] = "phrase";
    }
    setLiveAddText(la);
    setLiveAddMatch(lm);

    const cnJoin = (data.campaign_negative_keywords ?? []).map((k) => k.text).join("\n");
    setDraftCampaignNegText(cnJoin);
    const cn0 = (data.campaign_negative_keywords ?? [])[0]?.match_type as MatchSel | undefined;
    setDraftCampaignNegMatch(cn0 === "exact" || cn0 === "phrase" || cn0 === "broad" ? cn0 : "phrase");

    const agNegT: Record<string, string> = {};
    const agNegM: Record<string, MatchSel> = {};
    for (const ag of data.ad_groups) {
      const negs = ag.negative_keywords ?? [];
      agNegT[ag.id] = negs.map((k) => k.text).join("\n");
      const m0 = negs[0]?.match_type as MatchSel | undefined;
      agNegM[ag.id] = m0 === "exact" || m0 === "phrase" || m0 === "broad" ? m0 : "phrase";
    }
    setDraftAgNegText(agNegT);
    setDraftAgNegMatch(agNegM);

    const ext = extensionsDraftFromDto(data.asset_extensions ?? null);
    setExtCalloutsText(ext.extCalloutsText);
    setExtSitelinksText(ext.extSitelinksText);
    setExtSnippetHeader(ext.extSnippetHeader);
    setExtSnippetValuesText(ext.extSnippetValuesText);

    setPreviewAgId((prev) =>
      prev && data.ad_groups.some((g) => g.id === prev) ? prev : data.ad_groups[0]?.id ?? null,
    );
  }, [ok, projectId, campaignId]);

  useEffect(() => {
    void loadStudio();
  }, [loadStudio]);

  const campaign = studio?.campaign;
  const published = studio?.published ?? false;

  const hint = campaign
    ? publishedBidStrategyHint("create_campaign", {
        hasGoogleBiddingDetail:
          !!(campaign.bidding_config && typeof campaign.bidding_config.google === "object"),
      })
    : null;

  const showManualCpc = isManualCpc(campaign?.bidding_config as Record<string, unknown> | undefined);

  const studioNavItemClass = (s: StudioSection) =>
    cn(
      "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
      studioSection === s
        ? "bg-muted font-medium text-foreground"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
    );

  /** Negativas + extensões para PATCH do rascunho (reutilizado pelo gravar completo e pela secção dedicada). */
  function negativesExtensionsDraftPayload(forStudio: GoogleCampaignStudioDto) {
    return {
      google_asset_extensions: buildGoogleAssetExtensionsPayload(
        extCalloutsText,
        extSitelinksText,
        extSnippetHeader,
        extSnippetValuesText,
      ),
      campaign_negative_keywords: linesToNegKeywords(draftCampaignNegText, draftCampaignNegMatch),
      ad_group_negative_keywords: forStudio.ad_groups.map((ag) => ({
        ad_group_id: ag.id,
        keywords: linesToNegKeywords(draftAgNegText[ag.id] ?? "", draftAgNegMatch[ag.id] ?? "phrase"),
      })),
    };
  }

  async function enqueue(action: Record<string, unknown>) {
    if (!ok) return;
    const { data, error } = await paidAdsService.postGoogleStudioActions(projectId!, campaignId!, action);
    if (error) {
      toast.error(error);
      return;
    }
    if (data?.change_request?.status === "applied") {
      toast.success(isAutopilot ? "Alteração aplicada na Google (modo automático)." : "Alteração aplicada.");
    } else {
      toast.success("Pedido registado na fila de aprovações.");
    }
    await loadStudio();
    await reloadPaid();
  }

  const previewKeywordHint = useCallback(
    (agId: string) => {
      const fromDraft = (draftKwText[agId] ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)[0];
      if (fromDraft) return fromDraft;
      const ag = studio?.ad_groups.find((g) => g.id === agId);
      return ag?.keywords[0]?.text;
    },
    [draftKwText, studio?.ad_groups],
  );

  async function submitLiveRsa(ag: GoogleStudioAdGroupRow) {
    const rsa0 = ag.rsa[0];
    if (!rsa0 || !ok || !projectId || !campaignId) return;
    const headlines = (draftRsaH[ag.id] ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 15);
    const descriptions = (draftRsaD[ag.id] ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4);
    const rawUrl = (draftRsaFinalUrl[ag.id] ?? "").trim();
    const fallback = (rsa0.final_urls?.[0] ?? "").trim();
    const urlResolved = rawUrl || fallback;
    if (!/^https:\/\/.+/i.test(urlResolved)) {
      toast.error("Indique uma URL final válida começando por https://");
      return;
    }
    if (headlines.length < 3 || descriptions.length < 2) {
      toast.error("RSA: mínimo 3 títulos e 2 descrições.");
      return;
    }
    const { error } = await paidAdsService.postGoogleStudioActions(projectId, campaignId, {
      action: "update_rsa",
      rsa_id: rsa0.id,
      headlines,
      descriptions,
      final_urls: [urlResolved],
      path1: (draftRsaPath1[ag.id] ?? "").trim(),
      path2: (draftRsaPath2[ag.id] ?? "").trim(),
    });
    if (error) toast.error(error);
    else {
      toast.success("Pedido RSA enviado.");
      await loadStudio();
      await reloadPaid();
    }
  }

  async function saveCampaignDraftMeta() {
    if (!ok || published || !studio) return;
    const name = campaignIdentityName.trim();
    const objective_summary = campaignObjectiveDraft.trim()
      ? campaignObjectiveDraft.trim().slice(0, 4000)
      : null;
    if (!name) {
      toast.error("Introduza o nome da campanha.");
      return;
    }
    const { error } = await paidAdsService.patchGoogleCampaignDraft(projectId!, campaignId!, {
      name,
      objective_summary,
    });
    if (error) toast.error(error);
    else {
      toast.success("Dados da campanha atualizados no rascunho.");
      await loadStudio();
      await reloadPaid();
    }
  }

  async function saveCampaignBiddingConfig() {
    if (!ok || !studio) return;
    const nCpa = bidStrategy === "target_cpa" ? Number(bidCpaUsd.replace(",", ".")) : null;
    const nRoas = bidStrategy === "target_roas" ? Number(bidRoas.replace(",", ".")) : null;
    const nMax = bidStrategy === "manual_cpc" ? Number(bidMaxCpcUsd.replace(",", ".")) : null;
    if (bidStrategy === "target_cpa") {
      if (!Number.isFinite(nCpa as number) || (nCpa as number) <= 0) {
        toast.error("Indique um CPA alvo válido (USD).");
        return;
      }
    }
    if (bidStrategy === "target_roas") {
      if (!Number.isFinite(nRoas as number) || (nRoas as number) <= 0) {
        toast.error("Indique um ROAS alvo válido.");
        return;
      }
    }
    if (bidStrategy === "manual_cpc" && bidMaxCpcUsd.trim() !== "") {
      if (!Number.isFinite(nMax as number) || (nMax as number) <= 0) {
        toast.error("CPC máximo inválido (USD), ou deixe em branco.");
        return;
      }
    }

    const patchBody = {
      google_bidding_strategy: bidStrategy,
      google_target_cpa_usd: bidStrategy === "target_cpa" ? nCpa : null,
      google_target_roas: bidStrategy === "target_roas" ? nRoas : null,
      google_max_cpc_usd:
        bidStrategy === "manual_cpc" && Number.isFinite(nMax as number) && (nMax as number) > 0 ? nMax : null,
    };

    if (published) {
      await enqueue({
        action: "update_campaign_bidding",
        ...patchBody,
      });
    } else {
      const { error, data } = await paidAdsService.patchGoogleCampaignDraft(projectId!, campaignId!, patchBody);
      if (error) toast.error(error);
      else {
        toast.success("Estratégia de licitação gravada no rascunho.");
        if (data?.studio) setStudio(data.studio);
        await reloadPaid();
      }
    }
  }

  const loadCampaignPerformance = useCallback(async () => {
    if (!ok || !published || !projectId || !campaignId) return;
    setPerfLoading(true);
    setPerfErr(null);
    const { data, error } = await paidAdsService.getGoogleCampaignPerformance(
      projectId,
      campaignId,
      perfFrom,
      perfTo,
    );
    setPerfLoading(false);
    if (error) {
      setPerfErr(error);
      setPerfRows([]);
      setPerfTotals(null);
      return;
    }
    if (!data) {
      setPerfErr("Resposta vazia.");
      setPerfRows([]);
      setPerfTotals(null);
      return;
    }
    setPerfRows(data.rows);
    setPerfTotals(data.totals);
  }, [ok, published, projectId, campaignId, perfFrom, perfTo]);

  async function saveBudget(publishedCampaign: boolean) {
    const n = Number(budgetUsd.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Introduza um orçamento diário válido (USD).");
      return;
    }
    if (!ok) return;
    if (publishedCampaign) {
      await enqueue({ action: "update_budget_usd", daily_budget_usd: n });
    } else {
      const daily_budget_micros = Math.round(n * 1_000_000);
      const { error } = await paidAdsService.patchGoogleCampaignDraft(projectId!, campaignId!, {
        daily_budget_micros,
      });
      if (error) toast.error(error);
      else {
        toast.success("Orçamento de rascunho actualizado.");
        await loadStudio();
      }
    }
  }

  async function saveDraftAll() {
    if (!studio || !ok || published) return;
    const ad_groups: {
      id: string;
      keywords: Array<{ text: string; match_type: MatchSel }>;
      rsa: {
        id: string;
        headlines: string[];
        descriptions: string[];
        final_urls: string[];
        path1: string;
        path2: string;
      };
    }[] = [];

    for (const ag of studio.ad_groups) {
      const rsa0 = ag.rsa[0];
      if (!rsa0) continue;
      const lines = (draftKwText[ag.id] ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((t) => t.slice(0, 80));
      const mt = draftKwMatch[ag.id] ?? "phrase";

      const hLines = (draftRsaH[ag.id] ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 15);
      const dLines = (draftRsaD[ag.id] ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 4);
      const rawUrl = (draftRsaFinalUrl[ag.id] ?? "").trim();
      const prevUrl = (rsa0.final_urls?.[0] ?? "").trim();
      const urlResolved = rawUrl || prevUrl;
      if (!/^https:\/\/.+/i.test(urlResolved)) {
        toast.error(`Grupo «${ag.name}»: URL final obrigatória (https://…).`);
        return;
      }
      if (hLines.length < 3 || dLines.length < 2) {
        toast.error(`Grupo «${ag.name}»: RSA precisa de pelo menos 3 títulos e 2 descrições (linhas).`);
        return;
      }
      if (lines.length < 1) {
        toast.error(`Grupo «${ag.name}»: indique pelo menos uma palavra-chave (uma por linha).`);
        return;
      }
      ad_groups.push({
        id: ag.id,
        keywords: lines.map((text) => ({ text, match_type: mt })),
        rsa: {
          id: rsa0.id,
          headlines: hLines,
          descriptions: dLines,
          final_urls: [urlResolved],
          path1: (draftRsaPath1[ag.id] ?? "").trim().slice(0, 15),
          path2: (draftRsaPath2[ag.id] ?? "").trim().slice(0, 15),
        },
      });
    }

    const { error, data } = await paidAdsService.patchGoogleCampaignDraft(projectId!, campaignId!, {
      ad_groups,
      ...negativesExtensionsDraftPayload(studio),
    });
    if (error) toast.error(error);
    else {
      toast.success("Rascunho gravado (keywords, RSA, negativas e extensões).");
      if (data?.studio) setStudio(data.studio);
      await reloadPaid();
    }
  }

  async function saveNegativesExtensions() {
    if (!ok || !studio || !projectId || !campaignId) return;

    const nx = negativesExtensionsDraftPayload(studio);

    if (published) {
      const run = async (action: Record<string, unknown>) => {
        const { data: out, error: err } = await paidAdsService.postGoogleStudioActions(
          projectId,
          campaignId,
          action,
        );
        if (err) return { ok: false as const, error: err };
        return { ok: true as const, status: out?.change_request?.status };
      };

      let lastStatus: string | undefined;
      let r = await run({
        action: "sync_campaign_negative_keywords",
        keywords: nx.campaign_negative_keywords,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      lastStatus = r.status;

      for (const blk of nx.ad_group_negative_keywords) {
        r = await run({
          action: "sync_ad_group_negative_keywords",
          ad_group_id: blk.ad_group_id,
          keywords: blk.keywords,
        });
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        lastStatus = r.status;
      }

      r = await run({
        action: "replace_google_asset_extensions",
        extensions: nx.google_asset_extensions,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      lastStatus = r.status;

      if (lastStatus === "applied") {
        toast.success(isAutopilot ? "Negativas e extensões aplicadas na Google." : "Pedidos aplicados.");
      } else {
        toast.success("Pedidos registados na fila de aprovações.");
      }
      await loadStudio();
      await reloadPaid();
      return;
    }

    const { error, data } = await paidAdsService.patchGoogleCampaignDraft(projectId, campaignId, nx);
    if (error) toast.error(error);
    else {
      toast.success("Negativas e extensões gravadas no rascunho.");
      if (data?.studio) setStudio(data.studio);
      await reloadPaid();
    }
  }

  async function analyzeKeyword() {
    if (!ok || !projectId || !campaign) return;
    const k = insightKw.trim();
    if (!k) {
      toast.error("Escreva uma palavra-chave.");
      return;
    }
    setInsightLoading(true);
    setInsightResult(null);
    const { data, error } = await paidAdsService.postGoogleKeywordInsight(projectId, {
      keyword: k.slice(0, 80),
      countryCode: firstCountryIso(campaign),
      languageCode: firstLanguageCode(campaign),
      dailyBudgetUsd: Number(budgetUsd.replace(",", ".")) || undefined,
    });
    setInsightLoading(false);
    if (error) toast.error(error);
    else setInsightResult(data as unknown as Record<string, unknown>);
  }

  function adGroupCards(
    renderer: (
      ag: GoogleStudioAdGroupRow,
      i: number,
    ) => React.ReactNode,
  ) {
    if (!studio?.ad_groups?.length) {
      return <p className="text-sm text-muted-foreground">Sem grupos de anúncios nesta campanha.</p>;
    }
    return (
      <div className="space-y-8">
        {studio.ad_groups.map((ag, i) => (
          <Card key={ag.id}>
            <CardHeader className="space-y-1 pb-4">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <CardTitle className="text-base">{ag.name}</CardTitle>
                <div className="flex flex-wrap items-center gap-1">
                  <BadgeEntityStatus s={campaignStatusLabel(ag.status)} />
                  {ag.external_ad_group_id ? (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      grp {ag.external_ad_group_id}
                    </span>
                  ) : null}
                </div>
              </div>
              {!published ? (
                <CardDescription>
                  Edita em baixo; no fim da secção usa «Gravar rascunho completo» (inclui negativas e extensões definidas no menu).
                </CardDescription>
              ) : (
                <CardDescription>Alterações na rede passam pela fila (ou são aplicadas de imediato em modo automático).</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">{renderer(ag, i)}</CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!ok) {
    return <p className="p-4 text-sm text-destructive">Campanha ou projecto inválido.</p>;
  }

  return (
    <Gate>
      <PageHeader
        title="Gestão da campanha"
        description={
          campaign ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center rounded border border-[#1a73e8]/35 bg-[#1a73e8]/08 px-2 py-0.5 text-xs font-semibold text-[#174ea6] dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-300">
                Google Ads · Pesquisa
              </span>
              <span>
                {campaign.name} · {published ? "Publicada" : "Rascunho"} · {campaignStatusLabel(campaign.status)}
              </span>
            </span>
          ) : (
            "A carregar…"
          )
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/campanhas`}>Voltar às campanhas</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/tracking/dpilot/p/${projectId}/aprovacoes`}>Fila de aprovações</Link>
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-4">
        {hint ? <p className="text-xs text-muted-foreground leading-snug max-w-prose">{hint}</p> : null}

        <Alert variant="default" className="border-neutral-200 bg-neutral-50/80 dark:border-border dark:bg-muted/25">
          <AlertTitle className="text-sm">Estúdio Google Ads (Pesquisa)</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
            Layout alinhado ao fluxo da consola: navegação à esquerda, formulário ao centro e{" "}
            <strong className="font-medium text-foreground">pré-visualização</strong> à direita. Licitações por dispositivo,
            públicos avançados e relatórios completos continuam em{" "}
            <a className="font-medium text-primary underline-offset-2 hover:underline" href="https://ads.google.com/" target="_blank" rel="noreferrer">
              ads.google.com
            </a>
            .
          </AlertDescription>
        </Alert>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-12">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            A carregar…
          </p>
        ) : !campaign || !studio ? (
          <p className="text-sm text-muted-foreground">Campanha não encontrada.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-[#f8f9fa] shadow-sm dark:border-border dark:bg-muted/10">
            <div className="h-1 w-full bg-[#1a73e8]" aria-hidden />
            {lgLayout ? (
              <p className="border-b border-neutral-200/90 bg-background/80 px-3 py-2 text-[10px] leading-snug text-muted-foreground dark:border-border">
                Arraste as barras entre colunas para ajustar índice, formulário e pré-visualização (como na Google Ads).
              </p>
            ) : null}
            <ResizablePanelGroup
              direction={lgLayout ? "horizontal" : "vertical"}
              autoSaveId={
                projectId && campaignId
                  ? `dpilot-google-studio-split-${projectId}-${campaignId}`
                  : "dpilot-google-studio-split"
              }
              className={cn(
                "bg-background",
                lgLayout ? "min-h-[min(720px,calc(100vh-220px))]" : "min-h-0 gap-6 p-3 pt-4",
              )}
            >
              <ResizablePanel
                defaultSize={lgLayout ? 22 : 28}
                minSize={lgLayout ? 14 : 12}
                maxSize={lgLayout ? 40 : 45}
                className="min-w-0"
              >
                <nav
                  className={cn(
                    "shrink-0 space-y-5",
                    lgLayout
                      ? "h-full overflow-y-auto border-r border-neutral-200 pb-4 pr-3 dark:border-border/70"
                      : "border-b border-neutral-200 pb-6 dark:border-border",
                  )}
                  aria-label="Secções do estúdio"
                >
              <div>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Campanha
                </p>
                <div className="space-y-0.5">
                  <button type="button" onClick={() => setStudioSection("visao")} className={studioNavItemClass("visao")}>
                    Visão geral
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioSection("conteudos")}
                    className={studioNavItemClass("conteudos")}
                  >
                    Palavras-chave e anúncios
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudioSection("negativas_extensoes")}
                    className={studioNavItemClass("negativas_extensoes")}
                  >
                    Negativas e extensões
                  </button>
                  <button type="button" onClick={() => setStudioSection("leiloes")} className={studioNavItemClass("leiloes")}>
                    Orçamento e licitação
                  </button>
                  <button type="button" onClick={() => setStudioSection("controlo")} className={studioNavItemClass("controlo")}>
                    {published ? "Estado e pausas" : "Estado do rascunho"}
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Ferramentas
                </p>
                <div className="space-y-0.5">
                  <button type="button" onClick={() => setStudioSection("insights")} className={studioNavItemClass("insights")}>
                    Planeamento e relatórios
                  </button>
                </div>
              </div>
                </nav>
              </ResizablePanel>

              {lgLayout ? (
                <ResizableHandle
                  withHandle
                  title="Redimensionar índice e conteúdo"
                  className="w-3 shrink-0 bg-border/70 transition-colors hover:bg-primary/20 data-[resize-handle-active]:bg-primary/30"
                />
              ) : (
                <div className="-mx-1 h-px shrink-0 bg-border/60" aria-hidden />
              )}

              <ResizablePanel
                defaultSize={lgLayout ? 76 : 72}
                minSize={lgLayout ? 48 : 40}
                className="min-w-0 flex flex-col"
              >
                <ResizablePanelGroup
                  direction={lgLayout ? "horizontal" : "vertical"}
                  autoSaveId={
                    projectId && campaignId
                      ? `dpilot-google-studio-editor-preview-${projectId}-${campaignId}`
                      : "dpilot-google-studio-editor-preview"
                  }
                  className={cn(
                    "min-h-0 flex-1",
                    lgLayout ? "min-h-[min(680px,calc(100vh-240px))]" : "min-h-0 gap-5",
                  )}
                >
                  <ResizablePanel defaultSize={lgLayout ? 64 : 58} minSize={lgLayout ? 38 : 30} className="min-w-0">
                    <div className="min-w-0 space-y-6 overflow-y-auto pr-0.5 lg:h-full lg:max-h-[min(760px,calc(100vh-200px))]">
            {studioSection === "visao" && (
            <div className="space-y-6">
              <Card className="border-muted-foreground/15 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Campanha</CardTitle>
                  <CardDescription>
                    Leitura rápida ao estilo «definições» da Google antes de editar noutras secções.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="leading-relaxed text-muted-foreground">
                    A campanha{" "}
                    <strong className="font-medium text-foreground">{campaign.name}</strong> está{" "}
                    <strong className="font-medium text-foreground">{campaignStatusLabel(campaign.status)}</strong>
                    {published ? " na rede" : " como rascunho no Clickora"}. Orçamento de referência:{" "}
                    <strong className="font-medium text-foreground">
                      {typeof campaign.daily_budget_micros === "number" && Number.isFinite(campaign.daily_budget_micros)
                        ? `${formatUsdFromMicros(campaign.daily_budget_micros)} / dia`
                        : budgetUsd
                          ? `${budgetUsd} USD / dia (em edição)`
                          : "—"}
                    </strong>
                    . Licitação: <strong className="font-medium text-foreground">{googleBiddingStrategyShort(campaign)}</strong>
                    .
                  </p>
                  {!published ? (
                    <Collapsible defaultOpen={false} className="group/camp-id overflow-hidden rounded-lg border border-neutral-300/90 bg-muted/15 dark:border-border">
                      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30">
                        <span>Nome e objectivo (rascunho · personalizável)</span>
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/camp-id:rotate-180"
                          aria-hidden
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3 border-t border-neutral-200/90 px-4 py-4 dark:border-border">
                        <div className="space-y-1.5">
                          <Label htmlFor="studio-camp-name">Nome da campanha</Label>
                          <Input
                            id="studio-camp-name"
                            value={campaignIdentityName}
                            onChange={(e) => setCampaignIdentityName(e.target.value)}
                            maxLength={200}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="studio-camp-obj">Resumo do objectivo</Label>
                          <Textarea
                            id="studio-camp-obj"
                            value={campaignObjectiveDraft}
                            onChange={(e) => setCampaignObjectiveDraft(e.target.value)}
                            rows={3}
                            className="text-sm"
                            maxLength={4000}
                          />
                        </div>
                        <div className="flex justify-end">
                          <Button type="button" size="sm" variant="secondary" onClick={() => void saveCampaignDraftMeta()}>
                            Guardar nome e objectivo
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                  <Collapsible defaultOpen className="group/camp-sum overflow-hidden rounded-lg border border-neutral-300/90 dark:border-border">
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 bg-muted/10 px-4 py-3 text-left text-sm font-medium hover:bg-muted/25">
                      <span>Definições (resumo)</span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/camp-sum:rotate-180"
                        aria-hidden
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                  <StudioSettingsPanel className="rounded-none border-0 border-t bg-background">
                    <StudioSettingsRow
                      label="Nome"
                      value={<span className="font-medium text-foreground">{campaign.name}</span>}
                    />
                    <StudioSettingsRow label="Estado" value={campaignStatusLabel(campaign.status)} />
                    <StudioSettingsRow label="Rede" value="Pesquisa Google" />
                    <StudioSettingsRow label="Localização · idioma" value={geoLangSummaryLine(campaign)} subdued />
                    <StudioSettingsRow
                      label="Id na Google"
                      value={
                        <span className="font-mono text-xs wrap-break-word">
                          {campaign.external_campaign_id ?? "— (ainda sem id na conta)"}
                        </span>
                      }
                      subdued
                    />
                    <StudioSettingsRow
                      label="Objectivo"
                      value={
                        (campaign as { objective_summary?: string }).objective_summary?.trim() ||
                        "Sem resumo textual — herdado da criação do plano."
                      }
                      subdued
                    />
                  </StudioSettingsPanel>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              {!published ? (
                <Alert>
                  <AlertTitle>Rascunho</AlertTitle>
                  <AlertDescription>
                    Não há ligação a um ID de campanha na Google até publicar pela fila («Aplicações» / Autopilot).
                    Keywords, RSA, negativas e extensões gravam‑se no rascunho com «Gravar rascunho completo» em Keywords e RSA,
                    ou à parte na secção «Negativas e extensões».
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTitle>Alterações supervisionadas</AlertTitle>
                  <AlertDescription>
                    Cada modificação ao vivo neste estúdio cria um registo técnico. Em modo Copilot, um administrador
                    aplica em «Aprovações».
                  </AlertDescription>
                </Alert>
              )}
            </div>
            )}

            {studioSection === "conteudos" && (
            <div className="space-y-6">
              {!published ? (
                <>
                  {adGroupCards((ag) => (
                    <div className="space-y-4">
                      <StudioSettingsPanel>
                        <StudioSettingsRow
                          label="Palavras‑chave"
                          value={`${countNonEmptyLines(draftKwText[ag.id] ?? "")} linhas · ${matchTypeLabel(draftKwMatch[ag.id] ?? "phrase")}`}
                        />
                        <StudioSettingsRow
                          label="RSA · destino · caminho"
                          value={
                            <span className="block break-all">
                              <span className="font-mono text-xs">
                                {(draftRsaFinalUrl[ag.id] ?? "").trim() ||
                                  ag.rsa[0]?.final_urls?.[0] ||
                                  "— (URL final pendente)"}
                              </span>
                              <span className="mt-0.5 block text-muted-foreground text-xs">
                                {countNonEmptyLines(draftRsaH[ag.id] ?? "")} títulos ·{" "}
                                {countNonEmptyLines(draftRsaD[ag.id] ?? "")} descrições · caminho{" "}
                                <span className="font-mono">
                                  /
                                  {(draftRsaPath1[ag.id] ?? "").trim() || "—"}/
                                  {(draftRsaPath2[ag.id] ?? "").trim() || "—"}
                                </span>
                              </span>
                            </span>
                          }
                          subdued
                        />
                      </StudioSettingsPanel>
                      <Collapsible
                        defaultOpen
                        className="group/edit-kw"
                        onOpenChange={(open) => {
                          if (open) setPreviewAgId(ag.id);
                        }}
                      >
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/25 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40">
                          <span>Editar palavras‑chave e textos RSA</span>
                          <ChevronDown
                            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/edit-kw:rotate-180"
                            aria-hidden
                          />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="space-y-1.5 flex-1 min-w-[140px]">
                            <Label>Palavras‑chave (uma por linha)</Label>
                            <Textarea
                              value={draftKwText[ag.id] ?? ""}
                              onChange={(e) =>
                                setDraftKwText((prev) => ({
                                  ...prev,
                                  [ag.id]: e.target.value,
                                }))
                              }
                              rows={5}
                              className="font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Correspondência aplicada às linhas</Label>
                            <Select
                              value={draftKwMatch[ag.id] ?? "phrase"}
                              onValueChange={(v) =>
                                setDraftKwMatch((prev) => ({
                                  ...prev,
                                  [ag.id]: v as MatchSel,
                                }))
                              }
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="broad">Ampla</SelectItem>
                                <SelectItem value="phrase">Expressão</SelectItem>
                                <SelectItem value="exact">Exacta</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <GoogleAdsStudioRsaCreativeBlock
                        finalUrlId={`g-rsa-draft-final-${ag.id}`}
                        finalUrl={draftRsaFinalUrl[ag.id] ?? ""}
                        onFinalUrlChange={(v) =>
                          setDraftRsaFinalUrl((prev) => ({
                            ...prev,
                            [ag.id]: v,
                          }))
                        }
                        path1={draftRsaPath1[ag.id] ?? ""}
                        path2={draftRsaPath2[ag.id] ?? ""}
                        onPath1={(v) =>
                          setDraftRsaPath1((prev) => ({
                            ...prev,
                            [ag.id]: v,
                          }))
                        }
                        onPath2={(v) =>
                          setDraftRsaPath2((prev) => ({
                            ...prev,
                            [ag.id]: v,
                          }))
                        }
                        headlines={draftRsaH[ag.id] ?? ""}
                        onHeadlines={(next) =>
                          setDraftRsaH((prev) => ({
                            ...prev,
                            [ag.id]: next,
                          }))
                        }
                        descriptions={draftRsaD[ag.id] ?? ""}
                        onDescriptions={(next) =>
                          setDraftRsaD((prev) => ({
                            ...prev,
                            [ag.id]: next,
                          }))
                        }
                        keywordHints={keywordHintsFromDraftLines(draftKwText[ag.id] ?? "")}
                      />
                    </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ))}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="rounded-lg px-8 font-semibold shadow-md transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-lg"
                      onClick={() => void saveDraftAll()}
                    >
                      Gravar rascunho completo (grupos + negativas + extensões)
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {adGroupCards((ag) => {
                    const parts = (liveAddText[ag.id] ?? "")
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean)
                      .map((t) => t.slice(0, 80));

                    const addBtn =
                      parts.length === 0
                        ? ""
                        : `Adicionar ${parts.length} palavra(s) à rede`;

                    const kwHintsLive = Array.from(
                      new Map(ag.keywords.map((k) => [k.text.toLowerCase(), k])).values(),
                    ).map((k) => ({ text: k.text }));

                    const rsa0 = ag.rsa[0];

                    return (
                      <div className="space-y-4">
                        <StudioSettingsPanel>
                          <StudioSettingsRow
                            label="Palavras‑chave"
                            value={`${ag.keywords.length} na rede (${ag.keywords.filter((k) => k.status !== "paused").length} activas)`}
                          />
                          <StudioSettingsRow
                            label="Anúncio RSA"
                            value={
                              ag.rsa[0]
                                ? `${ag.rsa[0].headlines.length} títulos · ${ag.rsa[0].descriptions.length} descrições`
                                : "Sem RSA neste grupo"
                            }
                            subdued
                          />
                        </StudioSettingsPanel>
                        <Collapsible
                          defaultOpen
                          className="group/edit-live"
                          onOpenChange={(open) => {
                            if (open) setPreviewAgId(ag.id);
                          }}
                        >
                          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/25 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/40">
                            <span>Gerir palavras‑chave e anúncio na rede</span>
                            <ChevronDown
                              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/edit-live:rotate-180"
                              aria-hidden
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-6 pt-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Palavras‑chave</p>
                          <div className="rounded-md border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/40">
                                  <th className="text-left p-2 font-medium">Palavra</th>
                                  <th className="text-left p-2 font-medium w-24">Match</th>
                                  <th className="text-left p-2 font-medium w-28">Estado</th>
                                  <th className="text-right p-2 font-medium">Acções</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ag.keywords.map((kw) => (
                                  <tr key={kw.id} className="border-b last:border-b-0">
                                    <td className="p-2 align-middle">{kw.text}</td>
                                    <td className="p-2 align-middle text-muted-foreground text-xs">{kw.match_type}</td>
                                    <td className="p-2 align-middle">
                                      <BadgeEntityStatus s={kw.status === "paused" ? "Pausado" : "Activo"} />
                                    </td>
                                    <td className="p-2 align-middle text-right">
                                      <div className="flex flex-wrap justify-end gap-1">
                                        {kw.status === "paused" ? (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            type="button"
                                            className="h-8"
                                            onClick={() =>
                                              void enqueue({ action: "resume_keyword", keyword_id: kw.id })
                                            }
                                          >
                                            Activar
                                          </Button>
                                        ) : (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            type="button"
                                            className="h-8"
                                            onClick={() =>
                                              void enqueue({ action: "pause_keyword", keyword_id: kw.id })
                                            }
                                          >
                                            Pausar
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          type="button"
                                          className="h-8 text-destructive"
                                          onClick={() => void enqueue({ action: "remove_keyword", keyword_id: kw.id })}
                                        >
                                          Remover
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                            <div className="space-y-1.5">
                              <Label>Adicionar (uma ou mais linhas)</Label>
                              <Textarea
                                value={liveAddText[ag.id] ?? ""}
                                onChange={(e) =>
                                  setLiveAddText((prev) => ({
                                    ...prev,
                                    [ag.id]: e.target.value,
                                  }))
                                }
                                rows={3}
                                className="text-xs font-mono"
                                placeholder={"exemplo 1\nexemplo 2"}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Match</Label>
                              <Select
                                value={liveAddMatch[ag.id] ?? "phrase"}
                                onValueChange={(v) =>
                                  setLiveAddMatch((prev) => ({
                                    ...prev,
                                    [ag.id]: v as MatchSel,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="broad">Ampla</SelectItem>
                                  <SelectItem value="phrase">Expressão</SelectItem>
                                  <SelectItem value="exact">Exacta</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full border-primary/35 bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] font-medium text-foreground hover:border-primary/55 hover:bg-primary/12"
                                disabled={parts.length === 0}
                                onClick={() =>
                                  void enqueue({
                                    action: "add_keywords",
                                    ad_group_id: ag.id,
                                    keywords: parts.map((text) => ({
                                      text,
                                      match_type: liveAddMatch[ag.id] ?? "phrase",
                                    })),
                                  }).then(() => {
                                    setLiveAddText((prev) => ({
                                      ...prev,
                                      [ag.id]: "",
                                    }));
                                  })
                                }
                              >
                                {addBtn || "Adicionar"}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Anúncio RSA</p>
                          {rsa0 ? (
                            <div className="flex flex-col gap-6">
                              <GoogleAdsStudioRsaCreativeBlock
                                finalUrlId={`g-rsa-live-final-${rsa0.id}`}
                                finalUrl={draftRsaFinalUrl[ag.id] ?? ""}
                                onFinalUrlChange={(v) =>
                                  setDraftRsaFinalUrl((prev) => ({
                                    ...prev,
                                    [ag.id]: v,
                                  }))
                                }
                                path1={draftRsaPath1[ag.id] ?? ""}
                                path2={draftRsaPath2[ag.id] ?? ""}
                                onPath1={(v) =>
                                  setDraftRsaPath1((prev) => ({
                                    ...prev,
                                    [ag.id]: v,
                                  }))
                                }
                                onPath2={(v) =>
                                  setDraftRsaPath2((prev) => ({
                                    ...prev,
                                    [ag.id]: v,
                                  }))
                                }
                                headlines={draftRsaH[ag.id] ?? ""}
                                onHeadlines={(next) =>
                                  setDraftRsaH((prev) => ({
                                    ...prev,
                                    [ag.id]: next,
                                  }))
                                }
                                descriptions={draftRsaD[ag.id] ?? ""}
                                onDescriptions={(next) =>
                                  setDraftRsaD((prev) => ({
                                    ...prev,
                                    [ag.id]: next,
                                  }))
                                }
                                keywordHints={kwHintsLive}
                              />
                              <div className="flex justify-end border-t border-border/60 pt-4">
                                <Button type="button" onClick={() => void submitLiveRsa(ag)}>
                                  Gravar textos na rede (fila / Autopilot)
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Sem RSA neste grupo.</p>
                          )}
                        </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            )}

            {studioSection === "negativas_extensoes" && (
              <div className="space-y-6">
                <Card className="border-muted-foreground/15 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Palavras-chave negativas</CardTitle>
                    <CardDescription>
                      {published
                        ? "Substitui as negativas na conta Google (remove critérios antigos e cria esta lista). Em Copilot, segue a fila de aprovações."
                        : "Grava no rascunho local (este botão ou «Gravar rascunho completo» em Palavras-chave e anúncios); serão enviadas na primeira publicação da campanha."}{" "}
                      Use uma linha por termo; o tipo de correspondência aplica-se a todas as linhas deste bloco.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1.5 flex-1 min-w-[160px]">
                          <Label>Negativas ao nível da campanha</Label>
                          <Textarea
                            value={draftCampaignNegText}
                            onChange={(e) => setDraftCampaignNegText(e.target.value)}
                            rows={5}
                            className="font-mono text-xs"
                            placeholder={"grátis\nemprego"}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Correspondência</Label>
                          <Select
                            value={draftCampaignNegMatch}
                            onValueChange={(v) => setDraftCampaignNegMatch(v as MatchSel)}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="broad">{matchTypeLabel("broad")}</SelectItem>
                              <SelectItem value="phrase">{matchTypeLabel("phrase")}</SelectItem>
                              <SelectItem value="exact">{matchTypeLabel("exact")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {studio?.ad_groups?.length ? (
                      <div className="space-y-6">
                        <Separator />
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Por grupo de anúncios
                        </p>
                        {studio.ad_groups.map((ag) => (
                          <div key={`neg-${ag.id}`} className="space-y-2 rounded-lg border border-border/60 bg-muted/15 p-4">
                            <p className="text-sm font-medium">{ag.name}</p>
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="space-y-1.5 flex-1 min-w-[160px]">
                                <Label>Negativas do grupo</Label>
                                <Textarea
                                  value={draftAgNegText[ag.id] ?? ""}
                                  onChange={(e) =>
                                    setDraftAgNegText((prev) => ({
                                      ...prev,
                                      [ag.id]: e.target.value,
                                    }))
                                  }
                                  rows={4}
                                  className="font-mono text-xs"
                                  placeholder={"concorrente\nisenção"}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Correspondência</Label>
                                <Select
                                  value={draftAgNegMatch[ag.id] ?? "phrase"}
                                  onValueChange={(v) =>
                                    setDraftAgNegMatch((prev) => ({
                                      ...prev,
                                      [ag.id]: v as MatchSel,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="broad">{matchTypeLabel("broad")}</SelectItem>
                                    <SelectItem value="phrase">{matchTypeLabel("phrase")}</SelectItem>
                                    <SelectItem value="exact">{matchTypeLabel("exact")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="border-muted-foreground/15 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Extensões Search (sitelinks, destaques, snippet)</CardTitle>
                    <CardDescription>
                      Sitelinks: uma linha por link, formato{" "}
                      <span className="font-mono text-[11px]">texto | https://…</span> (mínimo 2 válidos para enviar).
                      Destaques: uma linha cada (até 10). Snippet estruturado: cabeçalho Google e pelo menos 3 valores
                      (uma linha por valor); se omitir valores, o servidor completa com sugestões seguras.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="space-y-1.5">
                      <Label>Sitelinks</Label>
                      <Textarea
                        value={extSitelinksText}
                        onChange={(e) => setExtSitelinksText(e.target.value)}
                        rows={6}
                        className="font-mono text-xs"
                        placeholder={"Oferta | https://exemplo.com/oferta\nFAQ | https://exemplo.com/faq"}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Destaques (callouts)</Label>
                      <Textarea
                        value={extCalloutsText}
                        onChange={(e) => setExtCalloutsText(e.target.value)}
                        rows={5}
                        className="font-mono text-xs"
                        placeholder={"Envio rápido\nPagamento seguro"}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Cabeçalho do snippet estruturado</Label>
                        <Select
                          value={extSnippetHeader}
                          onValueChange={(v) => setExtSnippetHeader(v as StudioSnippetHeader)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STUDIO_SNIPPET_HEADERS.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Valores do snippet (≥3 linhas para substituir o gerado)</Label>
                        <Textarea
                          value={extSnippetValuesText}
                          onChange={(e) => setExtSnippetValuesText(e.target.value)}
                          rows={4}
                          className="font-mono text-xs"
                          placeholder={"Serviço A\nServiço B\nServiço C"}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="rounded-lg px-8 font-semibold shadow-md transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-lg"
                    disabled={!studio}
                    onClick={() => void saveNegativesExtensions()}
                  >
                    {published ? "Enviar negativas e extensões (fila / rede)" : "Gravar negativas e extensões no rascunho"}
                  </Button>
                </div>
              </div>
            )}

            {studioSection === "leiloes" && (
            <div className="space-y-6">
              <Card className="border-muted-foreground/15 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Orçamento e licitação</CardTitle>
                  <CardDescription>
                    URL final e textos RSA ficam em «Keywords e RSA». Aqui ajusta orçamento diário, estratégia de
                    licitação (CPC, CPA, ROAS, maximizar conversões) e consulta métricas da rede quando a campanha já
                    existe na conta Google.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-sm">
                  <ul className="list-inside list-disc space-y-1 text-[12px] text-muted-foreground">
                    {googleBiddingSummaryLinesFromPayload(campaign as unknown as Record<string, unknown>).map(
                      (line) => (
                        <li key={line.slice(0, 80)}>{line}</li>
                      ),
                    )}
                  </ul>

                  <div className="space-y-3 rounded-lg border border-border/70 bg-muted/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Estratégia de licitação · editar
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="studio-bid-strategy">Estratégia</Label>
                        <Select
                          value={bidStrategy}
                          onValueChange={(v) => setBidStrategy(v as GoogleStudioBiddingStrategyKey)}
                        >
                          <SelectTrigger id="studio-bid-strategy" className="max-w-md">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="maximize_conversions">Maximizar conversões</SelectItem>
                            <SelectItem value="target_cpa">Maximizar conversões · CPA alvo</SelectItem>
                            <SelectItem value="target_roas">ROAS alvo</SelectItem>
                            <SelectItem value="maximize_clicks">Maximizar cliques</SelectItem>
                            <SelectItem value="manual_cpc">CPC manual (com tecto por grupo)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {bidStrategy === "target_cpa" ? (
                        <div className="space-y-2">
                          <Label htmlFor="studio-bid-cpa">CPA alvo (USD / conversão)</Label>
                          <Input
                            id="studio-bid-cpa"
                            inputMode="decimal"
                            value={bidCpaUsd}
                            onChange={(e) => setBidCpaUsd(e.target.value)}
                            placeholder="ex. 25"
                            className="max-w-[11rem]"
                          />
                        </div>
                      ) : null}
                      {bidStrategy === "target_roas" ? (
                        <div className="space-y-2">
                          <Label htmlFor="studio-bid-roas">ROAS alvo</Label>
                          <Input
                            id="studio-bid-roas"
                            inputMode="decimal"
                            value={bidRoas}
                            onChange={(e) => setBidRoas(e.target.value)}
                            placeholder="ex. 3.5"
                            className="max-w-[11rem]"
                          />
                        </div>
                      ) : null}
                      {bidStrategy === "manual_cpc" ? (
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="studio-bid-max-cpc">Lance máximo por clique (USD)</Label>
                          <Input
                            id="studio-bid-max-cpc"
                            inputMode="decimal"
                            value={bidMaxCpcUsd}
                            onChange={(e) => setBidMaxCpcUsd(e.target.value)}
                            placeholder="Opcional — aplica-se a todos os grupos na rede"
                            className="max-w-[11rem]"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Valor usado como tecto inicial em cada grupo; pode afinar por grupo abaixo quando a
                            estratégia for CPC manual.
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button type="button" onClick={() => void saveCampaignBiddingConfig()}>
                        {published ? "Enviar estratégia à rede (fila / Autopilot)" : "Gravar estratégia no rascunho"}
                      </Button>
                    </div>
                  </div>

                  <StudioSettingsPanel>
                    <StudioSettingsRow
                      label="Orçamento (USD / dia)"
                      value={
                        <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                          <div className="w-full space-y-1 sm:w-auto sm:text-right">
                            <Input
                              id="usd-budget"
                              inputMode="decimal"
                              value={budgetUsd}
                              onChange={(e) => setBudgetUsd(e.target.value)}
                              className="max-w-[11rem] sm:ml-auto"
                            />
                            {campaign.daily_budget_micros ? (
                              <p className="text-[11px] text-muted-foreground">
                                Gravado: {formatUsdFromMicros(campaign.daily_budget_micros)}
                              </p>
                            ) : null}
                          </div>
                          <Button type="button" onClick={() => void saveBudget(published)}>
                            Gravar orçamento
                          </Button>
                        </div>
                      }
                    />
                  </StudioSettingsPanel>
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/15 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Desempenho na rede</CardTitle>
                  <CardDescription>
                    Dados reportados pela Google Ads para esta campanha (soma por dia no intervalo).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {!published ? (
                    <p className="text-muted-foreground">
                      As métricas aparecem aqui depois de publicar a campanha na conta OAuth do projecto.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="perf-from">Desde</Label>
                          <Input
                            id="perf-from"
                            type="date"
                            value={perfFrom}
                            onChange={(e) => setPerfFrom(e.target.value)}
                            className="w-[11rem]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="perf-to">Até</Label>
                          <Input
                            id="perf-to"
                            type="date"
                            value={perfTo}
                            onChange={(e) => setPerfTo(e.target.value)}
                            className="w-[11rem]"
                          />
                        </div>
                        <Button type="button" variant="secondary" disabled={perfLoading} onClick={() => void loadCampaignPerformance()}>
                          {perfLoading ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              A carregar…
                            </span>
                          ) : (
                            "Carregar métricas"
                          )}
                        </Button>
                      </div>
                      {perfErr ? (
                        <p className="text-sm text-destructive">{perfErr}</p>
                      ) : null}
                      {perfTotals ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-[13px]">
                          <div className="rounded-md border bg-muted/15 px-3 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Impressões
                            </p>
                            <p className="font-semibold tabular-nums">{perfTotals.impressions.toLocaleString("pt-PT")}</p>
                          </div>
                          <div className="rounded-md border bg-muted/15 px-3 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Cliques
                            </p>
                            <p className="font-semibold tabular-nums">{perfTotals.clicks.toLocaleString("pt-PT")}</p>
                          </div>
                          <div className="rounded-md border bg-muted/15 px-3 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              CPC médio
                            </p>
                            <p className="font-semibold tabular-nums">
                              {perfTotals.clicks > 0
                                ? formatUsdFromMicros(Math.round(perfTotals.cost_micros / perfTotals.clicks))
                                : "—"}
                            </p>
                          </div>
                          <div className="rounded-md border bg-muted/15 px-3 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Custo</p>
                            <p className="font-semibold tabular-nums">{formatUsdFromMicros(perfTotals.cost_micros)}</p>
                          </div>
                          <div className="rounded-md border bg-muted/15 px-3 py-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Conversões
                            </p>
                            <p className="font-semibold tabular-nums">
                              {perfTotals.conversions.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      ) : null}
                      {perfRows.length > 0 ? (
                        <div className="max-h-[min(420px,50vh)] overflow-auto rounded-md border">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-muted/80">
                              <tr className="border-b">
                                <th className="p-2 text-left font-medium">Dia</th>
                                <th className="p-2 text-right font-medium">Impr.</th>
                                <th className="p-2 text-right font-medium">Cli.</th>
                                <th className="p-2 text-right font-medium">CPC méd.</th>
                                <th className="p-2 text-right font-medium">Custo</th>
                                <th className="p-2 text-right font-medium">Conv.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {perfRows.map((row) => (
                                <tr key={row.date} className="border-b last:border-0">
                                  <td className="p-2 font-mono">{row.date}</td>
                                  <td className="p-2 text-right tabular-nums">{row.impressions.toLocaleString("pt-PT")}</td>
                                  <td className="p-2 text-right tabular-nums">{row.clicks.toLocaleString("pt-PT")}</td>
                                  <td className="p-2 text-right tabular-nums">
                                    {row.clicks > 0
                                      ? formatUsdFromMicros(Math.round(row.cost_micros / row.clicks))
                                      : "—"}
                                  </td>
                                  <td className="p-2 text-right tabular-nums">{formatUsdFromMicros(row.cost_micros)}</td>
                                  <td className="p-2 text-right tabular-nums">
                                    {row.conversions.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : published && !perfLoading && !perfErr && perfTotals === null ? (
                        <p className="text-muted-foreground text-xs">
                          Escolha as datas e use «Carregar métricas» (máx. 95 dias por pedido).
                        </p>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>

              {published && showManualCpc ? (
                <AdGroupCpcEditors groups={studio.ad_groups} enqueueFn={enqueue} />
              ) : published && !showManualCpc ? (
                <Alert>
                  <AlertTitle>CPC nos grupos</AlertTitle>
                  <AlertDescription>
                    A estratégia escolhida nesta campanha não usa CPC manual nos grupos. Para ajustes finos de lances ao
                    nível das palavras‑chave, utilize a conta Google Ads.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Após publicar em modo CPC manual poderá definir aqui um lance máximo por grupo.
                </p>
              )}
            </div>
            )}

            {studioSection === "controlo" && (
            <div className="space-y-6">
              {!published ? (
                <Alert>
                  <AlertTitle>Rascunho</AlertTitle>
                  <AlertDescription>
                    Pausar ou activar recursos só está disponível após a campanha existir na Google com IDs remotos.
                  </AlertDescription>
                </Alert>
              ) : (
                <Card className="border-muted-foreground/15 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Estado na rede</CardTitle>
                    <CardDescription>
                      Pausas e activações — equivalente rápido a «Estado da campanha» e controlos por grupo na Google.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <p className="leading-relaxed text-muted-foreground">
                      Em modo <strong className="font-medium text-foreground">Copilot</strong>, estas acções podem criar uma
                      entrada em «Aprovações». Em modo automático aplicam assim que a conta permitir.
                    </p>
                    <StudioSettingsPanel>
                      <StudioSettingsRow
                        label="Campanha inteira"
                        value={
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <BadgeEntityStatus s={campaignStatusLabel(campaign.status)} />
                            {campaign.status === "paused" ? (
                              <Button type="button" size="sm" onClick={() => void enqueue({ action: "resume_campaign" })}>
                                Reactivar campanha
                              </Button>
                            ) : (
                              <Button type="button" variant="destructive" size="sm" onClick={() => void enqueue({ action: "pause_campaign" })}>
                                Pausar campanha inteira
                              </Button>
                            )}
                          </div>
                        }
                      />
                    </StudioSettingsPanel>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Grupos e anúncios</p>
                    <div className="space-y-3">
                      {studio.ad_groups.map((ag) => (
                        <StudioSettingsPanel key={ag.id}>
                          <StudioSettingsRow label="Grupo" value={<span className="font-medium">{ag.name}</span>} />
                          <StudioSettingsRow
                            label="Estado do grupo"
                            value={
                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                <BadgeEntityStatus s={campaignStatusLabel(ag.status)} />
                                {ag.status === "paused" ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => void enqueue({ action: "resume_ad_group", ad_group_id: ag.id })}
                                  >
                                    Reactivar grupo
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    onClick={() => void enqueue({ action: "pause_ad_group", ad_group_id: ag.id })}
                                  >
                                    Pausar grupo
                                  </Button>
                                )}
                              </div>
                            }
                          />
                          {ag.rsa.map((r) => (
                            <StudioSettingsRow
                              key={r.id}
                              label="Anúncio RSA"
                              value={
                                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                  <BadgeEntityStatus s={r.status === "paused" ? "Pausado" : "Activo"} />
                                  {r.status === "paused" ? (
                                    <Button variant="outline" size="sm" type="button" onClick={() => void enqueue({ action: "resume_rsa", rsa_id: r.id })}>
                                      Activar anúncio
                                    </Button>
                                  ) : (
                                    <Button variant="outline" size="sm" type="button" onClick={() => void enqueue({ action: "pause_rsa", rsa_id: r.id })}>
                                      Pausar anúncio
                                    </Button>
                                  )}
                                </div>
                              }
                            />
                          ))}
                        </StudioSettingsPanel>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            )}

            {studioSection === "insights" && (
            <div className="space-y-6">
              <Card className="border-muted-foreground/15 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Planeamento em palavra‑chave</CardTitle>
                  <CardDescription>
                    Ligação rápida ao Planner (quando disponível). Parâmetros usados pelo pedido de análise:
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 max-w-xl">
                  <StudioSettingsPanel>
                    <StudioSettingsRow label="País (Mercado)" value={firstCountryIso(campaign)} />
                    <StudioSettingsRow label="Idioma" value={firstLanguageCode(campaign)} />
                    <StudioSettingsRow
                      label="Orçamento diário (contexto opcional)"
                      value={budgetUsd.trim() ? `${budgetUsd.replace(",", ".")} USD/dia` : "—"}
                      subdued
                    />
                  </StudioSettingsPanel>
                  <div className="space-y-1.5">
                    <Label>Palavra‑chave</Label>
                    <Input value={insightKw} onChange={(e) => setInsightKw(e.target.value)} placeholder="ex.: sapato couro lisboa" />
                  </div>
                  <Button type="button" variant="secondary" disabled={insightLoading} onClick={() => void analyzeKeyword()}>
                    {insightLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        A analisar…
                      </>
                    ) : (
                      "Obter insights"
                    )}
                  </Button>
                  {insightResult ? (
                    <div className="rounded-lg border bg-muted/20 p-4 text-sm space-y-2 mt-4">
                      <p>
                        Volume mensal estimado:&nbsp;
                        <strong>{String(insightResult.monthly_search_volume ?? "—")}</strong>
                      </p>
                      <p>CPC médio (referência): {String(insightResult.avg_cpc_usd ?? "—")} USD</p>
                      {Array.isArray(insightResult.analysis_bullets_pt) ? (
                        <ul className="list-disc pl-5 space-y-1 text-xs">
                          {(insightResult.analysis_bullets_pt as string[]).slice(0, 8).map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      ) : null}
                      {insightResult.decision &&
                      typeof insightResult.decision === "object" &&
                      insightResult.decision &&
                      typeof (insightResult.decision as { decision_label_pt?: unknown }).decision_label_pt === "string" ? (
                        <p className="text-xs pt-2 text-muted-foreground">
                          Sugestão: {(insightResult.decision as { decision_label_pt: string }).decision_label_pt}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/15 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Relatórios completos na Google</CardTitle>
                  <CardDescription>
                    Como no menu «Estatísticas e relatórios» da consola Google Ads: métricas detalhadas, termos de pesquisa,
                    leilões, horários e localização, páginas de destino e painéis. Aqui ficam só um atalho e o planner de
                    palavras‑chave; não duplicamos toda a consola no Clickora.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <a
                      href="https://ads.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Abrir Google Ads
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    </a>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground leading-relaxed">
                      <li>Estatísticas e resumos de desempenho</li>
                      <li>Termos de pesquisa e leilões (auction insights)</li>
                      <li>Quando e onde os anúncios foram mostrados</li>
                      <li>Páginas de destino e painéis personalizados</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
            )}
                    </div>
                  </ResizablePanel>

                  {lgLayout ? (
                    <ResizableHandle
                      withHandle
                      title="Redimensionar formulário e pré-visualização"
                      className="w-2.5 shrink-0 bg-neutral-200 transition-colors hover:bg-[#1a73e8]/25 data-[resize-handle-active]:bg-[#1a73e8]/35 dark:bg-border"
                    />
                  ) : (
                    <div className="h-px shrink-0 bg-neutral-200 dark:bg-border" aria-hidden />
                  )}

                  <ResizablePanel
                    defaultSize={lgLayout ? 36 : 42}
                    minSize={lgLayout ? 24 : 20}
                    maxSize={lgLayout ? 50 : 55}
                    className="min-w-0"
                  >
                    <aside className="flex h-full min-h-[260px] flex-col gap-3 overflow-y-auto border-neutral-200 bg-[#fafafa] p-3 lg:sticky lg:top-0 lg:max-h-[min(760px,calc(100vh-200px))] lg:border-l lg:border-neutral-200 lg:pl-3 dark:border-border/60 dark:bg-muted/15">
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Pré-visualização · grupo
                        </p>
                        {studio.ad_groups.length > 1 ? (
                          <Select
                            value={previewAgId ?? studio.ad_groups[0]!.id}
                            onValueChange={(v) => setPreviewAgId(v)}
                          >
                            <SelectTrigger className="h-9 w-full bg-background text-left text-xs">
                              <SelectValue placeholder="Grupo de anúncios" />
                            </SelectTrigger>
                            <SelectContent>
                              {studio.ad_groups.map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                  {g.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : studio.ad_groups[0] ? (
                          <p className="truncate text-xs font-medium text-foreground">{studio.ad_groups[0].name}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sem grupos.</p>
                        )}
                      </div>
                      {previewAgId && studio.ad_groups.some((g) => g.id === previewAgId) ? (
                        <GoogleAdsRsaDraftPreview
                          className="shadow-sm"
                          finalUrl={
                            (draftRsaFinalUrl[previewAgId] ?? "").trim() ||
                            studio.ad_groups.find((g) => g.id === previewAgId)?.rsa[0]?.final_urls?.[0] ||
                            ""
                          }
                          path1={draftRsaPath1[previewAgId] ?? ""}
                          path2={draftRsaPath2[previewAgId] ?? ""}
                          headlinesText={draftRsaH[previewAgId] ?? ""}
                          descriptionsText={draftRsaD[previewAgId] ?? ""}
                          queryHint={previewKeywordHint(previewAgId)}
                          showCharacterGrid={studioSection === "conteudos"}
                        />
                      ) : null}
                      <p className="text-[10px] leading-snug text-muted-foreground">
                        Combinação de exemplo (primeiros titulares e descrições). Na rede Google, o RSA roda variantes
                        automaticamente.
                      </p>
                    </aside>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}
      </div>
    </Gate>
  );
}

function AdGroupCpcEditors({
  groups,
  enqueueFn,
}: {
  groups: GoogleStudioAdGroupRow[];
  enqueueFn: (a: Record<string, unknown>) => Promise<void>;
}) {
  const [usd, setUsd] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const ag of groups) {
      const m = ag.cpc_bid_micros;
      o[ag.id] =
        typeof m === "number" && Number.isFinite(m)
          ? (m / 1_000_000).toFixed(2)
          : "";
    }
    return o;
  });

  useEffect(() => {
    const o: Record<string, string> = {};
    for (const ag of groups) {
      const m = ag.cpc_bid_micros;
      o[ag.id] =
        typeof m === "number" && Number.isFinite(m)
          ? (m / 1_000_000).toFixed(2)
          : "";
    }
    setUsd(o);
  }, [groups]);

  return (
    <Card className="border-muted-foreground/15 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">CPC máximo por grupo</CardTitle>
        <CardDescription>
          Com estratégia CPC manual na campanha, defina um teto por grupo. A conta Google pode rejeitar valores fora dos
          limites.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <StudioSettingsPanel>
          {groups.map((ag) => (
            <StudioSettingsRow
              key={ag.id}
              label={ag.name}
              value={
                <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                  <Input
                    inputMode="decimal"
                    placeholder="ex. 1,25 USD"
                    className="max-w-[9rem]"
                    value={usd[ag.id] ?? ""}
                    onChange={(e) => setUsd((prev) => ({ ...prev, [ag.id]: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-sky-500/40 bg-sky-500/8 font-semibold text-sky-950 hover:border-sky-500/65 hover:bg-sky-500/15 dark:border-sky-400/35 dark:bg-sky-500/15 dark:text-sky-100 dark:hover:bg-sky-500/25"
                    onClick={() => {
                      const n = Number((usd[ag.id] ?? "").replace(",", "."));
                      if (!Number.isFinite(n) || n <= 0) return;
                      void enqueueFn({
                        action: "update_ad_group_cpc_usd",
                        ad_group_id: ag.id,
                        max_cpc_usd: n,
                      });
                    }}
                  >
                    Aplicar
                  </Button>
                </div>
              }
            />
          ))}
        </StudioSettingsPanel>
      </CardContent>
    </Card>
  );
}
