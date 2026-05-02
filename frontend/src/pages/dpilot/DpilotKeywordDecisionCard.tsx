import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryLabel } from "@/lib/googleAdsTargeting";
import { paidAdsService } from "@/services/paidAdsService";
import { DpilotKeywordVolumeTrendChart } from "./DpilotKeywordVolumeTrendChart";

function formatPtInt(n: number): string {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(n);
}

type KeywordMetricsMode = "default" | "last_24" | "last_36" | "custom";

function rollingMonthRangeMonths(spanMonths: number): { start: string; end: string } {
  const back = Math.max(1, spanMonths) - 1;
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - back, 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}`,
  };
}

function parseMonthControlValue(s: string): { y: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10);
  if (mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

function monthIndexDiff(a: { y: number; m: number }, b: { y: number; m: number }): number {
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export type DpilotKeywordDecision = {
  keyword_score: number;
  score_breakdown_pt: Array<{ text: string; tone: "positive" | "warning" | "neutral" }>;
  decision_status: "recommended" | "caution" | "avoid";
  decision_label_pt: string;
  next_action_pt: string;
  budget_insight_pt: string | null;
};

export type DpilotKeywordInsight = {
  keyword: string;
  country_code: string;
  language_code: string;
  monthly_search_volume: number;
  avg_cpc_usd: number;
  competition_label_pt: string;
  analysis_bullets_pt: string[];
  related_keywords: string[];
  user_cpc_verdict_pt: string | null;
  user_cpc_status: "below" | "competitive" | "above" | null;
  data_provenance_pt: string;
  generated_at: string;
  local_cpc_display: { amount: number; suffix: string; disclaimer_pt: string } | null;
  metrics_source: "estimated" | "google_ads";
  cpc_from_google_ads: boolean;
  decision: DpilotKeywordDecision;
  volume_trend: {
    points: Array<{ year: number; month: number; day: number | null; volume: number }>;
    point_source: "google_monthly" | "synthetic_from_average" | "estimated_model";
    disclaimer_pt: string;
  };
};

export function DpilotKeywordDecisionCard({
  projectId,
  offer,
  landingHostname,
  primaryCountryCode,
  primaryLanguageCode,
  userCpcUsd,
  dailyBudgetUsd,
  desiredClicksPerDay,
  committedKeyword,
  onCommitKeyword,
  /** Países do wizard (até 10) — mesmo critério multi-localização do Keyword Planner Google. */
  geoCountryCodes,
}: {
  projectId: string;
  offer: string;
  landingHostname: string;
  primaryCountryCode: string;
  primaryLanguageCode: string;
  userCpcUsd: number | null;
  /** Orçamento diário USD do wizard — só este pedido / projeto (multi-tenant). */
  dailyBudgetUsd: number | null;
  desiredClicksPerDay: number | null;
  committedKeyword: string | null;
  onCommitKeyword: (keyword: string) => void;
  geoCountryCodes: string[];
}) {
  const [draft, setDraft] = useState("");
  const [insight, setInsight] = useState<DpilotKeywordInsight | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestReq = useRef(0);
  const [metricsMode, setMetricsMode] = useState<KeywordMetricsMode>("default");
  const [customRange, setCustomRange] = useState(() => rollingMonthRangeMonths(24));

  const loadSuggestions = useCallback(async () => {
    const o = offer.trim();
    if (o.length < 8) {
      setSuggestions([]);
      return;
    }
    const my = ++suggestReq.current;
    setLoadingSuggest(true);
    try {
      const { data, error } = await paidAdsService.postGoogleKeywordSuggest(projectId, {
        offer: o,
        languageCode: primaryLanguageCode,
        ...(landingHostname ? { landingHostname } : {}),
      });
      if (my !== suggestReq.current) return;
      if (error || !data?.ok || !data.suggestions?.length) {
        setSuggestions([]);
        return;
      }
      setSuggestions(data.suggestions);
    } finally {
      if (my === suggestReq.current) setLoadingSuggest(false);
    }
  }, [offer, landingHostname, primaryLanguageCode, projectId]);

  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => {
      void loadSuggestions();
    }, 500);
    return () => {
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
    };
  }, [loadSuggestions]);

  const plannerCountryCodes = useMemo(
    () =>
      [
        ...new Set(
          (geoCountryCodes.length ? geoCountryCodes : primaryCountryCode ? [primaryCountryCode] : [])
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
        ),
      ].slice(0, 10),
    [geoCountryCodes, primaryCountryCode],
  );

  const geoSummaryLabel = useMemo(() => {
    if (plannerCountryCodes.length === 0) return "";
    if (plannerCountryCodes.length === 1) return countryLabel(plannerCountryCodes[0]!);
    return plannerCountryCodes.map((c) => countryLabel(c)).join(", ");
  }, [plannerCountryCodes]);

  const runInsight = async () => {
    const kw = draft.trim();
    if (kw.length < 2) {
      toast.error("Indica uma palavra-chave.");
      return;
    }
    if (!primaryCountryCode && plannerCountryCodes.length === 0) {
      toast.error("Selecciona pelo menos um país de segmentação acima.");
      return;
    }

    let metricsPayload: {
      keywordMetricsTimeframe?: "last_24" | "last_36";
      keywordMetricsRange?: { startYear: number; startMonth: number; endYear: number; endMonth: number };
    } = {};
    if (metricsMode === "last_24") metricsPayload = { keywordMetricsTimeframe: "last_24" };
    else if (metricsMode === "last_36") metricsPayload = { keywordMetricsTimeframe: "last_36" };
    else if (metricsMode === "custom") {
      const a = parseMonthControlValue(customRange.start);
      const b = parseMonthControlValue(customRange.end);
      if (!a || !b) {
        toast.error("Intervalo inválido", { description: "Usa AAAA-MM no início e no fim." });
        return;
      }
      if (a.y * 100 + a.m > b.y * 100 + b.m) {
        toast.error("Intervalo inválido", { description: "O início deve ser anterior ou igual ao fim." });
        return;
      }
      if (monthIndexDiff(a, b) > 48) {
        toast.error("Intervalo demasiado largo", { description: "Máximo 48 meses (limite do servidor)." });
        return;
      }
      metricsPayload = {
        keywordMetricsRange: {
          startYear: a.y,
          startMonth: a.m,
          endYear: b.y,
          endMonth: b.m,
        },
      };
    }

    setLoadingInsight(true);
    setInsight(null);
    try {
      const primary = (plannerCountryCodes[0] ?? primaryCountryCode).trim().toUpperCase();
      const { data, error } = await paidAdsService.postGoogleKeywordInsight(projectId, {
        keyword: kw,
        countryCode: primary,
        ...(plannerCountryCodes.length > 1 ? { countryCodes: plannerCountryCodes } : {}),
        languageCode: primaryLanguageCode,
        ...(userCpcUsd != null && Number.isFinite(userCpcUsd) ? { userCpcUsd } : {}),
        ...(dailyBudgetUsd != null && Number.isFinite(dailyBudgetUsd) ? { dailyBudgetUsd } : {}),
        ...(desiredClicksPerDay != null && Number.isFinite(desiredClicksPerDay)
          ? { desiredClicksPerDay: Math.round(desiredClicksPerDay) }
          : {}),
        ...(offer.trim() ? { offerContext: offer.trim().slice(0, 500) } : {}),
        ...metricsPayload,
      });
      if (error || !data?.ok) {
        toast.error("Não foi possível analisar", { description: error ?? "Erro desconhecido" });
        return;
      }
      setInsight({
        keyword: data.keyword,
        country_code: data.country_code,
        language_code: data.language_code,
        monthly_search_volume: data.monthly_search_volume,
        avg_cpc_usd: data.avg_cpc_usd,
        competition_label_pt: data.competition_label_pt,
        analysis_bullets_pt: data.analysis_bullets_pt,
        related_keywords: data.related_keywords,
        user_cpc_verdict_pt: data.user_cpc_verdict_pt,
        user_cpc_status: data.user_cpc_status,
        data_provenance_pt: data.data_provenance_pt,
        generated_at: data.generated_at,
        local_cpc_display: data.local_cpc_display,
        metrics_source: data.metrics_source,
        cpc_from_google_ads: data.cpc_from_google_ads,
        decision: data.decision,
        volume_trend: data.volume_trend,
      });
    } finally {
      setLoadingInsight(false);
    }
  };

  const metricsBadge =
    insight?.metrics_source === "google_ads" ? (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/[0.08] font-normal text-emerald-800 dark:text-emerald-200">
        Dados: Google Ads (oficial)
      </Badge>
    ) : (
      <Badge variant="outline" className="font-normal text-muted-foreground">
        Dados: Estimativa inteligente
      </Badge>
    );

  const decisionToneClass = (t: "positive" | "warning" | "neutral") => {
    if (t === "positive") return "text-emerald-800 dark:text-emerald-200";
    if (t === "warning") return "text-amber-900 dark:text-amber-200";
    return "text-muted-foreground";
  };

  const decisionStatusShell = insight
    ? (() => {
        const s = insight.decision.decision_status;
        if (s === "recommended")
          return "border-emerald-500/30 bg-emerald-500/[0.08]";
        if (s === "caution") return "border-amber-500/35 bg-amber-500/[0.08]";
        return "border-destructive/35 bg-destructive/[0.07]";
      })()
    : "";

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Search className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
            Análise de palavra-chave
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Com conta Google Ads: números da <strong className="font-medium text-foreground/90">API Keyword Ideas</strong>{" "}
            (não Semrush), agregados por{" "}
            <span className="font-medium text-foreground/90">
              {geoSummaryLabel || countryLabel(primaryCountryCode)}
            </span>
            {plannerCountryCodes.length > 1 ? ` (${plannerCountryCodes.length} países)` : ""}. Sem conta: estimativa interna.
            A janela temporal das médias é configurável abaixo (predefinição da API, 24/36 meses ou intervalo personalizado).
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {insight ? metricsBadge : null}
          {committedKeyword ? (
            <Badge variant="secondary" className="max-w-[220px] truncate font-normal" title={committedKeyword}>
              Campanha: {committedKeyword}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kw-decision-draft" className="text-xs font-medium">
          Palavra-chave
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="kw-decision-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex.: chá para emagrecer"
            maxLength={80}
            className="flex-1"
          />
          <Button type="button" variant="default" className="shrink-0 gap-1" disabled={loadingInsight} onClick={runInsight}>
            {loadingInsight ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            Analisar
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/40 p-2.5">
        <Label htmlFor="kw-metrics-mode" className="text-xs font-medium">
          Janela de métricas (Google Keyword Ideas)
        </Label>
        <Select value={metricsMode} onValueChange={(v) => setMetricsMode(v as KeywordMetricsMode)}>
          <SelectTrigger id="kw-metrics-mode" className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Predefinição API (~12 meses)</SelectItem>
            <SelectItem value="last_24">Últimos 24 meses</SelectItem>
            <SelectItem value="last_36">Últimos 36 meses</SelectItem>
            <SelectItem value="custom">Personalizado (até 48 meses)</SelectItem>
          </SelectContent>
        </Select>
        {metricsMode === "custom" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-0.5">
              <Label htmlFor="kw-metrics-start" className="text-[11px] text-muted-foreground">
                Início
              </Label>
              <Input
                id="kw-metrics-start"
                type="month"
                className="h-9 text-xs"
                value={customRange.start}
                onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
              />
            </div>
            <div className="flex-1 space-y-0.5">
              <Label htmlFor="kw-metrics-end" className="text-[11px] text-muted-foreground">
                Fim
              </Label>
              <Input
                id="kw-metrics-end"
                type="month"
                className="h-9 text-xs"
                value={customRange.end}
                onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
              />
            </div>
          </div>
        ) : null}
        <p className="text-[10px] leading-snug text-muted-foreground">
          Para aproximar o que vês no Keyword Planner, usa o mesmo intervalo de datas. A predefinição segue a API Google.
        </p>
      </div>

      {loadingSuggest ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> A gerar sugestões a partir da oferta…
        </p>
      ) : suggestions.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground">Sugestões (da landing / oferta)</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-left text-[11px] font-normal leading-snug text-foreground hover:bg-muted/80"
                onClick={() => {
                  setDraft(s);
                  setInsight(null);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {insight ? (
        <div className="space-y-3 rounded-lg border border-border bg-card/80 p-3 text-[12px] shadow-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <div>
              <span className="text-muted-foreground">Volume (mensal)</span>
              <div className="font-semibold tabular-nums text-foreground">
                {formatPtInt(insight.monthly_search_volume)}
                {insight.metrics_source === "google_ads" ? " (Google)" : " (estim.)"}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">CPC médio</span>
              <div className="font-semibold tabular-nums text-foreground">
                {insight.metrics_source === "google_ads" && !insight.cpc_from_google_ads ? (
                  <span className="text-amber-800 dark:text-amber-200" title="Completado por modelo interno">
                    ~${insight.avg_cpc_usd.toFixed(2)}
                  </span>
                ) : (
                  `$${insight.avg_cpc_usd.toFixed(2)}`
                )}
                {insight.metrics_source === "google_ads" && insight.cpc_from_google_ads ? (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">conta Google</span>
                ) : null}
                {insight.local_cpc_display ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    (~{formatPtInt(insight.local_cpc_display.amount)} {insight.local_cpc_display.suffix})
                  </span>
                ) : null}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Concorrência</span>
              <div className="font-semibold text-foreground">{insight.competition_label_pt}</div>
            </div>
          </div>

          <DpilotKeywordVolumeTrendChart
            key={insight.generated_at}
            trend={insight.volume_trend}
            keyword={insight.keyword}
            countryCode={insight.country_code}
          />

          <div className="space-y-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold text-foreground">
                Pontuação da keyword:{" "}
                <span className="tabular-nums text-violet-700 dark:text-violet-300">
                  {insight.decision.keyword_score}/100
                </span>
              </p>
            </div>
            <ul className="space-y-1 text-[11px] leading-snug">
              {insight.decision.score_breakdown_pt.map((row, i) => (
                <li key={`${i}-${row.text.slice(0, 24)}`} className={decisionToneClass(row.tone)}>
                  {row.tone === "positive" ? "✔ " : row.tone === "warning" ? "⚠ " : "· "}
                  {row.text}
                </li>
              ))}
            </ul>
            <div className={`rounded-md border px-2.5 py-2 ${decisionStatusShell}`}>
              <div className="flex items-start gap-2">
                {insight.decision.decision_status === "recommended" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                ) : insight.decision.decision_status === "caution" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                ) : (
                  <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                )}
                <div>
                  <p className="text-[11px] font-semibold text-foreground">{insight.decision.decision_label_pt}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{insight.decision.next_action_pt}</p>
                </div>
              </div>
            </div>
            {insight.decision.budget_insight_pt ? (
              <div className="rounded-md border border-border/80 bg-background/50 px-2.5 py-2 text-[11px] text-foreground">
                <span className="font-medium">Orçamento e cliques: </span>
                {insight.decision.budget_insight_pt}
              </div>
            ) : null}
          </div>

          {insight.local_cpc_display ? (
            <p className="text-[10px] leading-snug text-muted-foreground">{insight.local_cpc_display.disclaimer_pt}</p>
          ) : null}

          <div>
            <p className="mb-1 text-[11px] font-medium text-foreground">Análise inteligente</p>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
              {insight.analysis_bullets_pt.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>

          {insight.related_keywords.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-medium text-foreground">Variações e long-tail</p>
              <div className="flex flex-wrap gap-1.5">
                {insight.related_keywords.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-muted/60"
                    onClick={() => {
                      setDraft(s);
                      setInsight(null);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {userCpcUsd != null && insight.user_cpc_verdict_pt ? (
            <div
              className={
                "rounded-md border px-2.5 py-2 text-[11px] " +
                (insight.user_cpc_status === "competitive"
                  ? "border-emerald-500/25 bg-emerald-500/[0.07]"
                  : insight.user_cpc_status === "below"
                    ? "border-amber-500/30 bg-amber-500/[0.08]"
                    : "border-sky-500/25 bg-sky-500/[0.06]")
              }
            >
              <span className="font-medium text-foreground">CPC do plano vs. keyword</span>
              <p className="mt-1 text-muted-foreground">
                Teu CPC indicativo: <span className="tabular-nums text-foreground">${userCpcUsd.toFixed(2)}</span> · CPC
                médio (análise):{" "}
                <span className="tabular-nums text-foreground">${insight.avg_cpc_usd.toFixed(2)}</span>
              </p>
              <p className="mt-1 text-foreground">{insight.user_cpc_verdict_pt}</p>
            </div>
          ) : null}

          <p className="border-t border-border pt-2 text-[10px] leading-snug text-muted-foreground">
            {insight.data_provenance_pt} Atualizado:{" "}
            {new Date(insight.generated_at).toLocaleString("pt-PT", {
              dateStyle: "short",
              timeStyle: "short",
            })}
            .
          </p>

          <Button
            type="button"
            className="w-full gap-1 sm:w-auto"
            variant="secondary"
            onClick={() => {
              onCommitKeyword(insight.keyword);
              toast.success("Palavra-chave aplicada ao plano", {
                description: "Será usada ao gerar o plano Search (keywords + orientação dos anúncios).",
              });
            }}
          >
            Usar e otimizar campanha com esta keyword
          </Button>
        </div>
      ) : null}
    </div>
  );
}
