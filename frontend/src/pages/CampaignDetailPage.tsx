import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, numberLocaleFor } from "@/i18n";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { buildTrackedPresellUrl, campaignsService } from "@/services/campaignsService";
import { getPublicPresellFullUrl } from "@/lib/publicPresellOrigin";
import { useCustomDomains } from "@/hooks/useCustomDomains";
import { rangeLast14Days } from "@/lib/dateRangePresets";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProToolbar,
  ProKpiGrid,
  ProKpiCell,
  ProPanel,
  ProStatusDot,
  ProInlineLink,
} from "@/components/enterprise/ProShell";

function money(n: number | null | undefined, locale: string) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(locale, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function statusLabel(s: string, t: (k: import("@/i18n").MessageKey) => string) {
  if (s === "active") return t("pages.campaigns.statusActive");
  if (s === "draft") return t("pages.campaigns.statusDraft");
  if (s === "paused") return t("pages.campaigns.statusPaused");
  return s;
}

export default function CampaignDetailPage() {
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [spendDraft, setSpendDraft] = useState<string | null>(null);
  const initial = useMemo(() => rangeLast14Days(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const { data: campaign, isLoading, isError, refetch } = useQuery({
    queryKey: ["campaigns", id, from, to],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await campaignsService.getById(id!, { from, to });
      if (error) throw new Error(error);
      return data!;
    },
  });

  const { data: customDomains = [] } = useCustomDomains();

  const activate = useMutation({
    mutationFn: async () => {
      const { error } = await campaignsService.update(id!, { status: "active" });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaigns", id] });
      toast.success(t("pages.campaignDetail.activated"));
    },
  });

  const saveSpend = useMutation({
    mutationFn: async (amount: number | null) => {
      const { error } = await campaignsService.update(id!, {
        spend_amount: amount,
        spend_currency: "USD",
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campaigns"] });
      setSpendDraft(null);
      toast.success(t("pages.campaignDetail.spendUpdated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message={t("pages.campaignDetail.loading")} />
      </div>
    );
  }
  if (isError || !campaign) {
    return <ErrorState message={t("pages.campaignDetail.loadError")} onRetry={() => refetch()} />;
  }

  const presellIsPublic = campaign.presell?.status === "published";
  const publicBase =
    campaign.presell_id && presellIsPublic
      ? getPublicPresellFullUrl(
          customDomains,
          campaign.presell?.custom_domain_id ?? null,
          { id: campaign.presell_id },
        )
      : null;
  const trackedUrl =
    publicBase && campaign.name
      ? buildTrackedPresellUrl(publicBase, campaign.name, campaign.traffic_source)
      : null;

  const copyLink = async () => {
    if (!trackedUrl) {
      toast.error(t("pages.campaignDetail.needPresell"));
      return;
    }
    await navigator.clipboard.writeText(trackedUrl);
    setCopied(true);
    toast.success(t("pages.campaignDetail.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const spendValue =
    spendDraft !== null
      ? spendDraft
      : campaign.spend_amount != null
        ? String(campaign.spend_amount)
        : "";
  const stats = campaign.stats;
  const profit = stats?.profit;
  const roas = stats?.roas;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={campaign.name}
        subtitle={fill(t("pages.campaignDetail.subtitleStats"), {
          source: campaign.traffic_source,
          country: campaign.country ? ` · ${campaign.country}` : "",
        })}
        meta={
          <>
            <ProStatusDot ok={campaign.status === "active"} label={statusLabel(campaign.status, t)} />
            <span className="font-mono tabular-nums">
              {from} → {to}
            </span>
            <span>{t("common.universalTime")}</span>
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/campanhas">{t("pages.campaignDetail.allCampaigns")}</Link>
          </Button>
        }
      />

      <ProToolbar>
        <DateRangeFilter
          from={from}
          to={to}
          showCompare={false}
          onApply={(p) => {
            setFrom(p.from);
            setTo(p.to);
          }}
        />
        {campaign.status !== "active" ? (
          <Button size="sm" onClick={() => activate.mutate()} disabled={activate.isPending}>
            {t("pages.campaignDetail.activate")}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => void copyLink()}
          disabled={!trackedUrl}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {t("pages.campaignDetail.copyAdLink")}
        </Button>
      </ProToolbar>

      <ProKpiGrid>
        <ProKpiCell label={t("common.clicks")} value={String(stats?.clicks ?? 0)} />
        <ProKpiCell label={t("common.sales")} value={String(stats?.conversions ?? 0)} />
        <ProKpiCell label={t("common.revenue")} value={money(stats?.revenue, numLocale)} />
        <ProKpiCell
          label="CVR"
          value={`${(stats?.conversion_rate ?? 0).toLocaleString(numLocale, { maximumFractionDigits: 2 })}%`}
        />
        <ProKpiCell
          label={t("pages.campaignDetail.manualSpend")}
          value={money(campaign.spend_amount, numLocale)}
          hint={t("pages.campaignDetail.manualSpendHint")}
        />
        <ProKpiCell
          label={t("pages.campaignDetail.periodProfit")}
          value={money(profit, numLocale)}
          tone={profit != null && profit < 0 ? "negative" : profit != null && profit > 0 ? "positive" : "muted"}
          hint={t("pages.campaignDetail.periodProfitHint")}
        />
        <ProKpiCell
          label="ROAS"
          value={roas != null ? `${roas.toLocaleString(numLocale, { maximumFractionDigits: 2 })}x` : "—"}
          hint={t("pages.campaignDetail.roasHint")}
        />
        <ProKpiCell label="EPC" value={money(stats?.epc, numLocale)} />
      </ProKpiGrid>

      <Tabs defaultValue="operacao">
        <TabsList className="h-auto flex-wrap gap-1 bg-card border border-border/70 p-1">
          <TabsTrigger value="operacao">{t("pages.campaignDetail.tabOps")}</TabsTrigger>
          <TabsTrigger value="presell">{t("pages.campaignDetail.tabPresell")}</TabsTrigger>
          <TabsTrigger value="tracking">{t("pages.campaignDetail.tabTracking")}</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ProPanel title={t("pages.campaignDetail.adLink")} description={t("pages.campaignDetail.adLinkDesc")}>
              <div className="space-y-3 px-4 py-4">
                {campaign.offer_url ? (
                  <p className="text-xs break-all">
                    <span className="text-muted-foreground">{t("pages.campaignDetail.offer")} </span>
                    <span className="font-mono">{campaign.offer_url}</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-600">{t("pages.campaignDetail.noOfferUrl")}</p>
                )}
                {trackedUrl ? (
                  <p className="text-[11px] font-mono text-muted-foreground break-all rounded-md border border-border/50 bg-muted/30 p-3">
                    {trackedUrl}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("pages.campaignDetail.needPublished")}</p>
                )}
              </div>
            </ProPanel>

            <ProPanel
              title={t("pages.campaignDetail.manualSpendTitle")}
              description={t("pages.campaignDetail.manualSpendDesc")}
            >
              <div className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="spend" className="text-xs">
                      EUR
                    </Label>
                    <Input
                      id="spend"
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-[140px] h-9"
                      value={spendValue}
                      onChange={(e) => setSpendDraft(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={saveSpend.isPending}
                    onClick={() => {
                      const raw = spendValue.trim();
                      if (!raw) {
                        saveSpend.mutate(null);
                        return;
                      }
                      const n = Number(raw.replace(",", "."));
                      if (!Number.isFinite(n) || n < 0) {
                        toast.error(t("pages.campaignDetail.spendInvalid"));
                        return;
                      }
                      saveSpend.mutate(n);
                    }}
                  >
                    {t("common.save")}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("pages.campaignDetail.preferSync")}{" "}
                  <ProInlineLink to="/integracoes/automizer">{t("pages.automizer.title")}</ProInlineLink>{" "}
                  {t("pages.campaignDetail.andRead")}{" "}
                  <ProInlineLink to="/resultados">{t("pages.googleAds.results")}</ProInlineLink>.
                </p>
              </div>
            </ProPanel>
          </div>
        </TabsContent>

        <TabsContent value="presell" className="mt-4">
          {campaign.presell ? (
            <ProPanel title={campaign.presell.title}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                <ProStatusDot
                  ok={campaign.presell.status === "published"}
                  label={
                    campaign.presell.status === "published"
                      ? t("pages.campaignDetail.published")
                      : campaign.presell.status === "draft"
                        ? t("pages.campaignDetail.draft")
                        : campaign.presell.status === "paused"
                          ? t("pages.campaignDetail.paused")
                          : campaign.presell.status
                  }
                />
                <Button size="sm" asChild>
                  <Link to="/presells">{t("pages.campaignDetail.managePresells")}</Link>
                </Button>
                {campaign.presell.status === "published" ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/p/${campaign.presell.id}`} target="_blank" rel="noreferrer">
                      {t("pages.campaignDetail.openPublic")}
                    </a>
                  </Button>
                ) : null}
              </div>
            </ProPanel>
          ) : (
            <ProPanel title={t("pages.campaignDetail.tabPresell")}>
              <div className="flex flex-col items-start gap-3 px-4 py-8">
                <p className="text-sm text-muted-foreground">{t("pages.campaignDetail.noPresell")}</p>
                <Button size="sm" onClick={() => navigate("/presells/nova")}>
                  {t("common.createPresell")}
                </Button>
              </div>
            </ProPanel>
          )}
        </TabsContent>

        <TabsContent value="tracking" className="mt-4">
          <ProPanel title={t("pages.campaignDetail.pipeline")} description={t("pages.campaignDetail.pipelineDesc")}>
            <ul className="divide-y divide-border/50 text-sm">
              {[
                [t("pages.campaignDetail.rowStatus"), t("pages.campaignDetail.rowStatusValue")],
                [t("pages.campaignDetail.rowParams"), t("pages.campaignDetail.rowParamsValue")],
                [t("pages.campaignDetail.rowClickId"), t("pages.campaignDetail.rowClickIdValue")],
                [t("pages.campaignDetail.rowNetwork"), t("pages.campaignDetail.rowNetworkValue")],
              ].map(([k, v]) => (
                <li key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <span className="text-xs font-medium text-right">{v}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 border-t border-border/60 px-4 py-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/integracoes/postback">{t("pages.campaignDetail.postback")}</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/tracking/url-builder?utm_campaign=${encodeURIComponent(campaign.name)}`}>
                  {t("pages.campaignDetail.urlBuilder")} <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
              <Collapsible open={advOpen} onOpenChange={setAdvOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    {t("pages.campaignDetail.advanced")}
                    <ChevronDown className={`h-4 w-4 transition-transform ${advOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/integracoes">{t("pages.campaignDetail.integrationsHub")}</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/configuracoes?avancado=1">{t("pages.campaignDetail.diagnostics")}</Link>
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ProPanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
