/**
 * Hub project-wide de termos de pesquisa — cortar desperdício em todas as campanhas Search.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Ban, Loader2, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useGoogleManagerPrefs, GOOGLE_MANAGER_ALL_CAMPAIGNS } from "@/hooks/useGoogleManagerPrefs";
import {
  GOOGLE_MANAGER_PRESETS,
  googleManagerPresetLabelKey,
  type GoogleManagerPreset,
} from "@/lib/googleManagerPrefs";
import { formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";
import { useDpilotPaid } from "./DpilotPaidContext";
import { Gate } from "./DpilotPaidPages";

const HUB_PRESETS = GOOGLE_MANAGER_PRESETS.filter(
  (p): p is GoogleManagerPreset =>
    p === "today" ||
    p === "yesterday" ||
    p === "last_7" ||
    p === "last_30" ||
    p === "this_month",
);

type TermRow = NonNullable<
  Awaited<ReturnType<typeof paidAdsService.getGoogleAdsProjectSearchTerms>>["data"]
>["terms"][number];

function rowKey(t: Pick<TermRow, "campaign_id" | "search_term">) {
  return `${t.campaign_id}::${t.search_term}`;
}

export function DpilotGoogleSearchTermsHubPage() {
  const { t } = useAppLocale();
  const { projectId } = useDpilotPaid();
  const { preset, setPreset, campaignFilter, setCampaignFilter, ensureCampaignFilterValid } =
    useGoogleManagerPrefs(projectId);
  const [wasteOnly, setWasteOnly] = useState(false);
  const [matchType, setMatchType] = useState<"exact" | "phrase" | "broad">("phrase");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [totals, setTotals] = useState<{
    rows: number;
    waste: number;
    campaigns_with_terms: number;
    published_campaigns: number;
  } | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.getGoogleAdsProjectSearchTerms(projectId, {
      preset,
      waste_only: wasteOnly,
      ...(campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS ? { campaign_id: campaignFilter } : {}),
    });
    if (error) {
      setErr(error);
      setTerms([]);
      setTotals(null);
      setNote(null);
      /** Filtro persistido apontava a campanha já apagada — limpar e deixar o próximo load recuperar. */
      if (
        campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS &&
        /não encontrada|not found/i.test(error)
      ) {
        setCampaignFilter(GOOGLE_MANAGER_ALL_CAMPAIGNS);
      }
    } else {
      setTerms(data?.terms ?? []);
      setTotals(data?.totals ?? null);
      setRange(data?.range ?? null);
      setNote(data?.note ?? null);
      setCampaignOptions(
        (data?.campaigns ?? []).map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelected(new Set());
    }
    setLoading(false);
  }, [projectId, preset, wasteOnly, campaignFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (campaignOptions.length === 0) return;
    ensureCampaignFilterValid(campaignOptions.map((c) => c.id));
  }, [campaignOptions, ensureCampaignFilterValid]);

  const waste = useMemo(
    () => terms.filter((t) => t.waste_candidate && !t.already_negative),
    [terms],
  );

  const toggle = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const negateSelected = async () => {
    if (selected.size === 0) return;
    const byCampaign = new Map<string, string[]>();
    for (const t of terms) {
      const key = rowKey(t);
      if (!selected.has(key) || t.already_negative) continue;
      const list = byCampaign.get(t.campaign_id) ?? [];
      list.push(t.search_term);
      byCampaign.set(t.campaign_id, list);
    }
    const items = [...byCampaign.entries()].map(([campaign_id, termList]) => ({
      campaign_id,
      terms: termList,
    }));
    if (items.length === 0) return;
    const termCount = items.reduce((s, i) => s + i.terms.length, 0);
    const matchLabel =
      matchType === "exact"
        ? t("pages.dpilot.google.cm.terms.matchLabelExact")
        : matchType === "broad"
          ? t("pages.dpilot.google.cm.terms.matchLabelBroad")
          : t("pages.dpilot.google.cm.terms.matchLabelPhrase");
    if (
      !window.confirm(
        fill(t("pages.dpilot.google.cm.terms.confirmBatch"), {
          terms: termCount,
          campaigns: items.length,
          match: matchLabel,
        }),
      )
    ) {
      return;
    }
    setBusy(true);
    const { data, error } = await paidAdsService.negateGoogleAdsSearchTermsBatch(projectId, {
      match_type: matchType,
      items,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (!data?.added) {
      toast.success(t("pages.dpilot.google.cm.terms.toastAlreadyBlocked"));
    } else if (data.failed) {
      toast.message(
        fill(t("pages.dpilot.google.cm.terms.toastPartialFail"), { added: data.added, failed: data.failed }),
      );
    } else if ((data.applied ?? 0) > 0 && (data.pending ?? 0) === 0) {
      toast.success(
        fill(t("pages.dpilot.google.cm.terms.toastApplied"), { added: data.added, campaigns: items.length }),
      );
    } else if ((data.pending ?? 0) > 0) {
      toast.message(
        fill(t("pages.dpilot.google.cm.terms.toastPending"), {
          added: data.added,
          applied: data.applied ?? 0,
          pending: data.pending,
        }),
      );
    } else {
      toast.message(
        fill(t("pages.dpilot.google.cm.terms.toastProcessed"), { added: data.added, campaigns: items.length }),
      );
    }
    void load();
  };

  return (
    <Gate>
      <div data-no-i18n>
      <div className="relative overflow-hidden rounded-xl border border-[#1a73e8]/25 bg-gradient-to-br from-[#1a73e8]/10 via-background to-background p-5 sm:p-6">
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2.5">
              <Search className="h-7 w-7 text-[#1a73e8]" aria-hidden />
              <span>{t("pages.dpilot.google.cm.terms.title")}</span>
              <Badge
                aria-hidden
                className="border border-[#1a73e8]/30 bg-[#1a73e8]/15 font-normal text-[#1a73e8] hover:bg-[#1a73e8]/15"
              >
                {t("pages.dpilot.google.cm.terms.badgeProject")}
              </Badge>
            </span>
          }
          description={
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("pages.dpilot.google.cm.terms.description")}
            </p>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="w-[220px]" aria-label={t("pages.dpilot.google.cm.common.filterByCampaignAria")}>
                  <SelectValue placeholder={t("pages.dpilot.google.cm.common.campaign")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GOOGLE_MANAGER_ALL_CAMPAIGNS}>
                    {t("pages.dpilot.google.cm.common.allCampaigns")}
                  </SelectItem>
                  {campaignOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="w-[170px]" aria-label={t("pages.dpilot.google.cm.periodAria")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HUB_PRESETS.map((p) => {
                    const key = googleManagerPresetLabelKey(p);
                    return (
                      <SelectItem key={p} value={p}>
                        {key ? t(key) : p}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={wasteOnly ? "secondary" : "outline"}
                size="sm"
                onClick={() => setWasteOnly((v) => !v)}
              >
                {t("pages.dpilot.google.cm.terms.wasteOnly")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          }
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.terms.kpiTerms")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{totals?.rows ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.terms.kpiWaste")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-amber-800 dark:text-amber-200">
              {totals?.waste ?? "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.terms.kpiCampaignsWithTerms")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{totals?.campaigns_with_terms ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("pages.dpilot.google.cm.terms.kpiLiveCampaigns")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">{totals?.published_campaigns ?? "—"}</p>
            {range ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {range.from} → {range.to}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="text-base">{t("pages.dpilot.google.cm.terms.blockTitle")}</CardTitle>
              <CardDescription>{t("pages.dpilot.google.cm.terms.blockDesc")}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={matchType}
                onValueChange={(v) => setMatchType(v as "exact" | "phrase" | "broad")}
              >
                <SelectTrigger className="w-[200px]" aria-label={t("pages.dpilot.google.cm.terms.matchAria")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phrase">{t("pages.dpilot.google.cm.terms.matchPhrase")}</SelectItem>
                  <SelectItem value="exact">{t("pages.dpilot.google.cm.terms.matchExact")}</SelectItem>
                  <SelectItem value="broad">{t("pages.dpilot.google.cm.terms.matchBroad")}</SelectItem>
                </SelectContent>
              </Select>
              {waste.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set(waste.map(rowKey)))}
                >
                  {fill(t("pages.dpilot.google.cm.terms.markWaste"), { n: waste.length })}
                </Button>
              ) : null}
              <Button type="button" size="sm" disabled={busy || selected.size === 0} onClick={() => void negateSelected()}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
                {fill(t("pages.dpilot.google.cm.terms.blockCount"), { n: selected.size })}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {note ? (
            <Alert>
              <AlertTitle className="text-sm">{t("pages.dpilot.google.cm.terms.noTermsYetTitle")}</AlertTitle>
              <AlertDescription className="text-xs space-y-2">
                <p>{note}</p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link to={`/tracking/dpilot/p/${projectId}/google/campanhas`}>{t("pages.dpilot.google.cm.terms.goImport")}</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {err ? (
            <Alert variant="destructive">
              <AlertTitle>{t("pages.dpilot.google.cm.common.loadFailed")}</AlertTitle>
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : terms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {fill(t("pages.dpilot.google.cm.terms.emptyPeriod"), {
                campaign:
                  campaignFilter !== GOOGLE_MANAGER_ALL_CAMPAIGNS
                    ? t("pages.dpilot.google.cm.common.emptyInCampaignSuffix")
                    : "",
                waste: wasteOnly ? t("pages.dpilot.google.cm.terms.emptyWasteSuffix") : "",
              })}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>{t("pages.dpilot.google.cm.terms.colQuery")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.campaign")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.terms.colImpressions")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.clicks")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.terms.colSpend")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.terms.colSales")}</TableHead>
                    <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terms.map((row) => {
                    const key = rowKey(row);
                    return (
                      <TableRow key={key} className={row.waste_candidate ? "bg-amber-500/5" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(key)}
                            disabled={row.already_negative}
                            onCheckedChange={(v) => toggle(key, v === true)}
                            aria-label={fill(t("pages.dpilot.google.cm.terms.selectAria"), { term: row.search_term })}
                          />
                        </TableCell>
                        <TableCell className="max-w-[14rem] font-medium">
                          <span className="line-clamp-2">{row.search_term}</span>
                        </TableCell>
                        <TableCell className="max-w-[12rem]">
                          <Link
                            className="line-clamp-2 text-xs text-[#1a73e8] hover:underline"
                            to={`/tracking/dpilot/p/${projectId}/campanhas/${row.campaign_id}/google`}
                          >
                            {row.campaign_name}
                          </Link>
                        </TableCell>
                        <TableCell>{row.metrics.impressions.toLocaleString()}</TableCell>
                        <TableCell>{row.metrics.clicks.toLocaleString()}</TableCell>
                        <TableCell>{formatUsdFromMicros(row.metrics.cost_micros)}</TableCell>
                        <TableCell>{row.metrics.conversions.toFixed(1)}</TableCell>
                        <TableCell>
                          {row.already_negative ? (
                            <Badge variant="secondary" className="font-normal">
                              {t("pages.dpilot.google.cm.terms.alreadyBlocked")}
                            </Badge>
                          ) : row.waste_candidate ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/50 font-normal text-amber-800 dark:text-amber-200"
                            >
                              {t("pages.dpilot.google.cm.terms.wasteBadge")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{row.status || "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </Gate>
  );
}
