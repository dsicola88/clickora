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
  publishedBidStrategyHint,
} from "@/lib/paidAdsUi";
import type {
  CampaignRow,
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

type MatchSel = "exact" | "phrase" | "broad";

type StudioSection = "visao" | "conteudos" | "leiloes" | "controlo" | "insights";

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
  /** Ao vivo por grupo — acrescentar palavras. */
  const [liveAddText, setLiveAddText] = useState<Record<string, string>>({});
  const [liveAddMatch, setLiveAddMatch] = useState<Record<string, MatchSel>>({});

  /** Insights */
  const [insightKw, setInsightKw] = useState("");
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightResult, setInsightResult] = useState<Record<string, unknown> | null>(null);

  const [studioSection, setStudioSection] = useState<StudioSection>("visao");

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

    const { error, data } = await paidAdsService.patchGoogleCampaignDraft(projectId!, campaignId!, { ad_groups });
    if (error) toast.error(error);
    else {
      toast.success("Rascunho gravado.");
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
                <CardDescription>Edita este grupo em baixo; depois usa «Gravar rascunho» no fim da secção Keywords e RSA.</CardDescription>
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
        title="Gestão Google Search"
        description={
          campaign
            ? `${campaign.name} · ${published ? "Publicada" : "Rascunho local"} · ${campaignStatusLabel(campaign.status)}`
            : "A carregar…"
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

        <Alert variant="default" className="border-border bg-muted/30">
          <AlertTitle className="text-sm">Âmbito do estúdio</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
            Esta vista cobre campanhas de <strong className="text-foreground font-medium">pesquisa</strong> criadas pelo
            Clickora: grupos, palavras‑chave, textos RSA, orçamento e pausas. Ajustes finos como{" "}
            <strong className="text-foreground font-medium">licitações por dispositivo</strong> continuam disponíveis na
            interface completa da Google (ads.google.com) — não estamos a replicar 100&nbsp;% da consola aqui.
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
          <div className="rounded-xl border border-border/70 bg-muted/20 p-1">
            {lgLayout ? (
              <p className="border-b border-border/50 px-3 py-2 text-[10px] leading-snug text-muted-foreground">
                Ponteiro sobre a barra entre índice e conteúdo para redimensionar. A proporção fica apenas neste
                navegador.
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
                "rounded-b-lg bg-background",
                lgLayout ? "min-h-[min(720px,calc(100vh-220px))]" : "min-h-0 gap-8 p-4 pt-5",
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
                      ? "h-full overflow-y-auto border-r border-border/60 pb-4 pr-3"
                      : "border-b border-border pb-6",
                  )}
                  aria-label="Secções do estúdio"
                >
              <div>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Campanha e conteúdo
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
                    Keywords e RSA
                  </button>
                  <button type="button" onClick={() => setStudioSection("leiloes")} className={studioNavItemClass("leiloes")}>
                    Orçamento e CPC
                  </button>
                  <button type="button" onClick={() => setStudioSection("controlo")} className={studioNavItemClass("controlo")}>
                    {published ? "Pausas ao vivo" : "Estado do rascunho"}
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Estatísticas e relatórios
                </p>
                <div className="space-y-0.5">
                  <button type="button" onClick={() => setStudioSection("insights")} className={studioNavItemClass("insights")}>
                    Insights e atalhos
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
                defaultSize={lgLayout ? 78 : 72}
                minSize={lgLayout ? 52 : 40}
                className="min-w-0"
              >
            <div className="min-w-0 flex-1 space-y-6 lg:overflow-y-auto lg:pr-1">
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
                    Keywords e RSA podem alterar‑se livremente com «Gravar rascunho» na secção Keywords e RSA (menu ao lado).
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
                      <Collapsible defaultOpen className="group/edit-kw">
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
                      Gravar rascunho completo (todos os grupos)
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
                        <Collapsible defaultOpen className="group/edit-live">
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
                          {ag.rsa[0] ? (
                            <>
                              <RsaLiveEditor
                                campaignId={campaignId!}
                                projectId={projectId!}
                                ag={ag}
                                onDone={() => {
                                  void loadStudio();
                                  void reloadPaid();
                                }}
                              />
                            </>
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

            {studioSection === "leiloes" && (
            <div className="space-y-6">
              <Card className="border-muted-foreground/15 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Orçamento e lances</CardTitle>
                  <CardDescription>
                    Resumo tipo «orçamentos e licitação» na Google — edite aqui apenas o dia a dia; estratégias avançadas
                    ficam na consola quando necessário.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="leading-relaxed text-muted-foreground">
                    Orçamento diário de referência:&nbsp;
                    <strong className="font-medium text-foreground">
                      {typeof campaign.daily_budget_micros === "number" && Number.isFinite(campaign.daily_budget_micros)
                        ? `${formatUsdFromMicros(campaign.daily_budget_micros)}`
                        : budgetUsd
                          ? `${budgetUsd} USD`
                          : "—"}
                    </strong>
                    . Licitação:&nbsp;
                    <strong className="font-medium text-foreground">{googleBiddingStrategyShort(campaign)}</strong>
                    {googleBiddingSummaryLinesFromPayload(campaign as unknown as Record<string, unknown>).length > 1
                      ? " — consulte a linha de detalhe abaixo quando existir CPA ou ROAS alvo."
                      : "."}
                  </p>
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
                    <StudioSettingsRow label="Estratégia de licitação" value={googleBiddingStrategyShort(campaign)} subdued />
                    {googleBiddingSummaryLinesFromPayload(campaign as unknown as Record<string, unknown>)
                      .slice(1)
                      .map((line, ix) => (
                        <StudioSettingsRow
                          key={`bid-extra-${ix}-${line.slice(0, 48)}`}
                          label={ix === 0 ? "Meta / parâmetro" : "Parâmetro"}
                          value={<span className="text-muted-foreground">{line}</span>}
                          subdued
                        />
                      ))}
                  </StudioSettingsPanel>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when server snapshots change
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

/** Editor RSA já publicado: envio directo através da fila. */
function RsaLiveEditor({
  projectId,
  campaignId,
  ag,
  onDone,
}: {
  projectId: string;
  campaignId: string;
  ag: GoogleStudioAdGroupRow;
  onDone: () => void;
}) {
  const rsa0 = ag.rsa[0];
  const [headlinesText, setHeadlinesText] = useState("");
  const [descriptionsText, setDescriptionsText] = useState("");
  const [finalUrl, setFinalUrl] = useState("");
  const [path1, setPath1] = useState("");
  const [path2, setPath2] = useState("");

  useEffect(() => {
    if (!rsa0) return;
    setHeadlinesText(rsa0.headlines.join("\n"));
    setDescriptionsText(rsa0.descriptions.join("\n"));
    setFinalUrl(rsa0.final_urls?.[0] ?? "");
    setPath1(rsa0.path1 ?? "");
    setPath2(rsa0.path2 ?? "");
  }, [rsa0]);

  async function submit() {
    if (!rsa0) return;
    const headlines = headlinesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 15);
    const descriptions = descriptionsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4);
    const rawUrl = finalUrl.trim();
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
      path1,
      path2,
    });
    if (error) toast.error(error);
    else {
      toast.success("Pedido RSA enviado.");
      onDone();
    }
  }

  if (!rsa0) return null;

  const kwHintsLive = Array.from(new Map(ag.keywords.map((k) => [k.text.toLowerCase(), k])).values()).map((k) => ({
    text: k.text,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="max-h-[min(780px,calc(100vh-10rem))] overflow-y-auto pr-1 lg:max-h-none">
        <GoogleAdsStudioRsaCreativeBlock
          finalUrlId={`g-rsa-live-final-${rsa0.id}`}
          finalUrl={finalUrl}
          onFinalUrlChange={setFinalUrl}
          path1={path1}
          path2={path2}
          onPath1={setPath1}
          onPath2={setPath2}
          headlines={headlinesText}
          onHeadlines={setHeadlinesText}
          descriptions={descriptionsText}
          onDescriptions={setDescriptionsText}
          keywordHints={kwHintsLive}
        />
      </div>
      <div className="flex justify-end border-t border-border/60 pt-4">
        <Button
          className="rounded-full px-10 font-semibold shadow-md ring-2 ring-primary/25 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/40"
          type="button"
          onClick={() => void submit()}
        >
          Gravar textos na rede (fila / Autopilot)
        </Button>
      </div>
    </div>
  );
}
