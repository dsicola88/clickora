/**
 * Termos de pesquisa + negar na campanha (API real; dono aplica já / equipa → Aprovações).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fill } from "@/i18n";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useGoogleManagerPrefs } from "@/hooks/useGoogleManagerPrefs";
import {
  GOOGLE_MANAGER_PRESETS,
  googleManagerPresetLabelKey,
} from "@/lib/googleManagerPrefs";
import { formatUsdFromMicros } from "@/lib/paidAdsUi";
import { paidAdsService } from "@/services/paidAdsService";

const TERM_PRESETS = GOOGLE_MANAGER_PRESETS.filter((p) =>
  p === "today" || p === "yesterday" || p === "last_7" || p === "last_30",
);

type TermRow = NonNullable<
  Awaited<ReturnType<typeof paidAdsService.getGoogleAdsSearchTerms>>["data"]
>["terms"][number];

export function DpilotGoogleSearchTermsPanel({
  projectId,
  campaignId,
  campaignName,
}: {
  projectId: string;
  campaignId: string;
  campaignName?: string;
}) {
  const { t } = useAppLocale();
  const { preset, setPreset } = useGoogleManagerPrefs(projectId);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await paidAdsService.getGoogleAdsSearchTerms(projectId, campaignId, { preset });
    if (error) {
      setErr(error);
      setTerms([]);
    } else {
      setTerms(data?.terms ?? []);
      setRange(data?.range ?? null);
      setSelected(new Set());
    }
    setLoading(false);
  }, [projectId, campaignId, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (term: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(term);
      else next.delete(term);
      return next;
    });
  };

  const negateSelected = async () => {
    const list = [...selected];
    if (list.length === 0) return;
    if (
      !window.confirm(fill(t("pages.dpilot.google.cm.termsPanel.confirm"), { n: list.length }))
    ) {
      return;
    }
    setBusy(true);
    const { data, error } = await paidAdsService.negateGoogleAdsSearchTerms(
      projectId,
      campaignId,
      list.map((text) => ({ text, match_type: "phrase" as const })),
    );
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (!data?.added) {
      toast.success(t("pages.dpilot.google.cm.terms.toastAlreadyBlocked"));
    } else if (data.change_request?.status === "applied") {
      toast.success(fill(t("pages.dpilot.google.cm.termsPanel.toastApplied"), { n: data.added }));
    } else if (data.change_request?.status === "pending") {
      toast.message(fill(t("pages.dpilot.google.cm.termsPanel.toastPending"), { n: data.added }));
    } else {
      toast.message(fill(t("pages.dpilot.google.cm.termsPanel.toastSent"), { added: data.added, total: data.total }));
    }
    void load();
  };

  const waste = terms.filter((t) => t.waste_candidate && !t.already_negative);

  return (
    <div className="space-y-4" data-no-i18n>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t("pages.dpilot.google.cm.termsPanel.title")}</p>
          <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
            {campaignName
              ? fill(t("pages.dpilot.google.cm.termsPanel.campaignPrefix"), { name: campaignName })
              : ""}
            {t("pages.dpilot.google.cm.termsPanel.subtitle")}
          </p>
          {range ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {range.from} → {range.to}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TERM_PRESETS.map((p) => {
                const key = googleManagerPresetLabelKey(p);
                return (
                  <SelectItem key={p} value={p}>
                    {key ? t(key) : p}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button type="button" size="sm" disabled={busy || selected.size === 0} onClick={() => void negateSelected()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
            {fill(t("pages.dpilot.google.cm.termsPanel.blockSelected"), { n: selected.size })}
          </Button>
        </div>
      </div>

      {waste.length > 0 ? (
        <Alert>
          <AlertTitle className="text-sm">
            {fill(t("pages.dpilot.google.cm.termsPanel.wasteAlertTitle"), { n: waste.length })}
          </AlertTitle>
          <AlertDescription className="text-xs">
            {t("pages.dpilot.google.cm.termsPanel.wasteAlertBody")}
            <Button
              type="button"
              variant="link"
              className="h-auto px-1 text-xs"
              onClick={() => setSelected(new Set(waste.map((w) => w.search_term)))}
            >
              {t("pages.dpilot.google.cm.termsPanel.markThese")}
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
        <Skeleton className="h-40 w-full" />
      ) : terms.length === 0 ? (
        <Alert>
          <AlertTitle className="text-sm">{t("pages.dpilot.google.cm.termsPanel.emptyTitle")}</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">
            {t("pages.dpilot.google.cm.termsPanel.emptyBody")}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t("pages.dpilot.google.cm.terms.colQuery")}</TableHead>
                <TableHead>{t("pages.dpilot.google.cm.terms.colImpressions")}</TableHead>
                <TableHead>{t("pages.dpilot.google.cm.common.clicks")}</TableHead>
                <TableHead>{t("pages.dpilot.google.cm.terms.colSpend")}</TableHead>
                <TableHead>{t("pages.dpilot.google.cm.terms.colSales")}</TableHead>
                <TableHead>{t("pages.dpilot.google.cm.common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((row) => (
                <TableRow key={row.search_term} className={row.waste_candidate ? "bg-amber-500/5" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(row.search_term)}
                      disabled={row.already_negative}
                      onCheckedChange={(v) => toggle(row.search_term, v === true)}
                      aria-label={fill(t("pages.dpilot.google.cm.terms.selectAria"), { term: row.search_term })}
                    />
                  </TableCell>
                  <TableCell className="max-w-[16rem] font-medium">
                    <span className="line-clamp-2">{row.search_term}</span>
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
