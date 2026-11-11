import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { integrationsService } from "@/services/integrationsService";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { LoadingState } from "@/components/LoadingState";
import { useState, useEffect } from "react";
import { PRO_PAGE_SHELL, ProPageHeader, ProPanel, ProTable, ProTh, ProTd, ProEmpty } from "@/components/enterprise/ProShell";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, numberLocaleFor } from "@/i18n";

/**
 * Automizer de keywords + sync de custos — controlo simples para media buyers Google Ads.
 */
export default function AffiliateAutomizerPage() {
  const { t, locale } = useAppLocale();
  const numLoc = numberLocaleFor(locale);
  const { user } = useAuth();
  const locked = !userCanWriteIntegrations(user);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["affiliate-automizer"],
    queryFn: async () => {
      const { data: d, error } = await integrationsService.getAffiliateAutomizer();
      if (error) throw new Error(error);
      return d!;
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [minSpend, setMinSpend] = useState(15);
  const [minClicks, setMinClicks] = useState(20);
  const [lookback, setLookback] = useState(3);
  const [metaAct, setMetaAct] = useState("");
  const [ttAdv, setTtAdv] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setDryRun(data.dry_run);
    setMinSpend(data.min_spend_usd);
    setMinClicks(data.min_clicks);
    setLookback(data.lookback_days);
    setMetaAct(data.meta_ads_account_id ?? "");
    setTtAdv(data.tiktok_advertiser_id ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async (extra?: { sync_costs_now?: boolean; run_automizer_now?: boolean }) => {
      const { data: d, error } = await integrationsService.patchAffiliateAutomizer({
        enabled,
        dry_run: dryRun,
        min_spend_usd: minSpend,
        min_clicks: minClicks,
        lookback_days: lookback,
        meta_ads_account_id: metaAct.trim() || null,
        tiktok_advertiser_id: ttAdv.trim() || null,
        ...extra,
      });
      if (error) throw new Error(error);
      return { data: d, extra };
    },
    onSuccess: ({ data: d, extra }) => {
      void qc.invalidateQueries({ queryKey: ["affiliate-automizer"] });
      if (extra?.sync_costs_now) {
        void qc.invalidateQueries({ queryKey: ["analytics"] });
        void qc.invalidateQueries({ queryKey: ["results"] });
        void qc.invalidateQueries({ queryKey: ["dashboard"] });
      }
      if (extra?.sync_costs_now && d?.cost_sync) {
        const parts: string[] = [];
        if (d.cost_sync.google.ok)
          parts.push(fill(t("pages.automizer.googleOk"), { n: d.cost_sync.google.rows ?? 0 }));
        else if (d.cost_sync.google.error && d.cost_sync.google.error !== "google_not_ready")
          parts.push(fill(t("pages.automizer.googleErr"), { error: d.cost_sync.google.error }));
        else parts.push(t("pages.automizer.googleConnect"));
        if (d.cost_sync.meta.ok) parts.push(fill(t("pages.automizer.metaOk"), { n: d.cost_sync.meta.rows ?? 0 }));
        else if (metaAct.trim() && d.cost_sync.meta.error && d.cost_sync.meta.error !== "meta_not_configured")
          parts.push(fill(t("pages.automizer.metaErr"), { error: d.cost_sync.meta.error }));
        if (d.cost_sync.tiktok.ok) parts.push(fill(t("pages.automizer.ttOk"), { n: d.cost_sync.tiktok.rows ?? 0 }));
        else if (ttAdv.trim() && d.cost_sync.tiktok.error && d.cost_sync.tiktok.error !== "tiktok_not_configured")
          parts.push(fill(t("pages.automizer.ttErr"), { error: d.cost_sync.tiktok.error }));
        const anyOk = d.cost_sync.google.ok || d.cost_sync.meta.ok || d.cost_sync.tiktok.ok;
        if (anyOk) toast.success(t("pages.automizer.costsUpdated"), { description: parts.join(" · ") });
        else toast.error(t("pages.automizer.costsFail"), { description: parts.join(" · ") });
        return;
      }
      if (extra?.run_automizer_now && d?.automizer_run) {
        const r = d.automizer_run;
        toast.success(t("pages.automizer.ran"), {
          description: fill(t("pages.automizer.ranDetail"), {
            evaluated: r.evaluated,
            paused: r.paused,
            dry: r.dry_run,
            skipped: r.skipped,
          }),
        });
        return;
      }
      toast.success(t("pages.automizer.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message={t("pages.automizer.loading")} />
      </div>
    );
  }

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.automizer.title")}
        subtitle={t("pages.automizer.subtitle")}
      />

      {data && (data.cost_sync_stale || !data.cost_sync_ok) ? (
        <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/[0.07] px-4 py-3 text-sm text-foreground">
          <p className="font-medium text-amber-950 dark:text-amber-100">
            {data.cost_sync_stale ? t("pages.automizer.stale") : t("pages.automizer.noPeriodCost")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {data.last_cost_sync_at
              ? fill(t("pages.automizer.lastSync"), {
                  when: new Date(data.last_cost_sync_at).toLocaleString(numLoc),
                })
              : null}
            {data.google_ads_ready ? t("pages.automizer.refreshForRoas") : t("pages.automizer.connectGoogle")}{" "}
            <Link to="/integracoes/google-ads" className="font-medium text-primary underline underline-offset-2">
              Google Ads
            </Link>
          </p>
        </div>
      ) : null}

      {!dryRun && enabled ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{t("pages.automizer.realMode")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("pages.automizer.realModeDetail")}</p>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <section className="max-w-none space-y-5 rounded-lg border border-border/70 bg-card p-5">
        <div className="flex items-start gap-3">
          <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{t("pages.automizer.rule")}</p>
            <p>{t("pages.automizer.startSim")}</p>
            {data?.last_cost_sync_at && data.cost_sync_ok ? (
              <p className="text-[11px]">
                {t("pages.automizer.costsOk")}{" "}
                <span className="font-mono tabular-nums text-foreground/80">
                  {new Date(data.last_cost_sync_at).toLocaleString(numLoc)}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-on">{t("pages.automizer.enablePause")}</Label>
          <Switch id="auto-on" checked={enabled} disabled={locked} onCheckedChange={setEnabled} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="auto-dry">{t("pages.automizer.simulation")}</Label>
            <p className="text-xs text-muted-foreground">{t("pages.automizer.simulationHint")}</p>
          </div>
          <Switch id="auto-dry" checked={dryRun} disabled={locked} onCheckedChange={setDryRun} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>{t("pages.automizer.minSpend")}</Label>
            <Input
              type="number"
              min={1}
              value={minSpend}
              disabled={locked}
              onChange={(e) => setMinSpend(Number(e.target.value) || 15)}
            />
            <p className="text-[10px] text-muted-foreground">{t("pages.automizer.minSpendHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("pages.automizer.minClicks")}</Label>
            <Input
              type="number"
              min={1}
              value={minClicks}
              disabled={locked}
              onChange={(e) => setMinClicks(Number(e.target.value) || 20)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("pages.automizer.lookback")}</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={lookback}
              disabled={locked}
              onChange={(e) => setLookback(Number(e.target.value) || 3)}
            />
          </div>
        </div>

        <div className="space-y-1.5 border-t border-border/50 pt-4">
          <Label>{t("pages.automizer.metaAccount")}</Label>
          <Input
            placeholder={t("pages.automizer.metaPlaceholder")}
            value={metaAct}
            disabled={locked}
            onChange={(e) => setMetaAct(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("pages.automizer.metaHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t("pages.automizer.tiktokAccount")}</Label>
          <Input
            placeholder={t("pages.automizer.tiktokPlaceholder")}
            value={ttAdv}
            disabled={locked}
            onChange={(e) => setTtAdv(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("pages.automizer.tiktokHint")}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button disabled={locked || save.isPending} onClick={() => save.mutate({})}>
            {t("common.save")}
          </Button>
          <Button
            variant="secondary"
            disabled={locked || save.isPending}
            onClick={() => save.mutate({ sync_costs_now: true })}
          >
            {t("pages.automizer.syncNow")}
          </Button>
          <Button
            variant="outline"
            disabled={locked || save.isPending || !enabled}
            onClick={() => save.mutate({ run_automizer_now: true })}
          >
            {t("pages.automizer.applyPauses")}
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/integracoes">{t("pages.automizer.back")}</Link>
          </Button>
        </div>
      </section>

      <ProPanel title={t("pages.automizer.history")} description={t("pages.automizer.historyDesc")}>
        {(data?.recent_logs?.length ?? 0) === 0 ? (
          <ProEmpty title={t("pages.automizer.emptyLogs")} detail={t("pages.automizer.emptyLogsDetail")} />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <ProTh>{t("pages.automizer.when")}</ProTh>
                <ProTh>{t("pages.automizer.keyword")}</ProTh>
                <ProTh>{t("pages.automizer.action")}</ProTh>
                <ProTh>{t("pages.automizer.mode")}</ProTh>
              </tr>
            </thead>
            <tbody>
              {data!.recent_logs.map((l) => (
                <tr key={l.id} className="hover:bg-muted/30">
                  <ProTd className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString(numLoc)}
                  </ProTd>
                  <ProTd mono>{l.keyword}</ProTd>
                  <ProTd>
                    <span className="text-xs">{l.action}</span>
                    {l.reason ? <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[280px]">{l.reason}</p> : null}
                  </ProTd>
                  <ProTd className="text-[11px]">
                    {l.dry_run ? t("pages.automizer.sim") : l.ok ? t("pages.automizer.real") : t("pages.automizer.err")}
                  </ProTd>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </ProPanel>
      </div>
    </div>
  );
}
