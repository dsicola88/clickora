import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  Save,
  Copy,
  Check,
  Mail,
  Bell,
  Link2,
  AlertCircle,
  ExternalLink,
  Loader2,
  ListOrdered,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { integrationsService } from "@/services/integrationsService";
import { useAuth } from "@/contexts/AuthContext";
import { userCanReadIntegrationSecrets, userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import {
  AFFILIATE_PLATFORMS,
  buildAffiliateFunnelEventUrl,
  buildAffiliatePostbackExampleUrl,
  getAffiliateFunnelGuide,
  getAffiliatePlatformDef,
  getAffiliatePostbackPreset,
} from "@/lib/marketingPlatforms";
import { ensureHttpsWebhookUrl } from "@/lib/webhookPublicUrl";
import {
  parseSaleChimeId,
  playSaleChime,
  SALE_CHIMES,
  saleChimeSound,
  setSaleChimeSound,
  type SaleChimeId,
} from "@/lib/saleChime";
import { currentPhonePushSupport, hasLocalWebPushSubscription, subscribeToWebPush } from "@/lib/webPushClient";
import { PRO_PAGE_SHELL, ProPageHeader } from "@/components/enterprise/ProShell";
import { PostbackMacroChecklist } from "@/components/PostbackMacroChecklist";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill } from "@/i18n";

export default function Plataformas() {
  const { t } = useAppLocale();
  const { user, refreshUser, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
  const intLocked = !userCanWriteIntegrations(user);
  const canReadSecrets = userCanReadIntegrationSecrets(user);
  /** Reservado a planos com flag no admin; super_admin ignora para suporte. */
  const hookPlanDenied =
    !isSuperAdmin && Boolean(user?.plan && user.plan.affiliate_webhook_enabled === false);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState("BuyGoods");
  const [emailField, setEmailField] = useState("");
  const [chime, setChime] = useState<SaleChimeId>(() => saleChimeSound());
  const [phonePushOn, setPhonePushOn] = useState<boolean | null>(null);
  const phoneSupport = useMemo(() => currentPhonePushSupport(), []);
  const chimeSynced = useRef(false);
  const [copied, setCopied] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);
  const [copiedFunnel, setCopiedFunnel] = useState<null | "checkout" | "lander" | "checkout_event">(null);

  const {
    data: info,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["integrations-affiliate-webhook-info"],
    enabled: !authLoading && !hookPlanDenied && canReadSecrets,
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getAffiliateWebhookInfo();
      if (err) throw new Error(err);
      if (!data) throw new Error(t("pages.networkSales.emptyResponse"));
      return data;
    },
  });

  useEffect(() => {
    if (info?.sale_notify_email !== undefined) {
      setEmailField(info.sale_notify_email);
    }
  }, [info?.sale_notify_email]);

  useEffect(() => {
    if (!info && user?.sale_notify_email) {
      setEmailField(user.sale_notify_email);
    }
  }, [info, user?.sale_notify_email]);

  useEffect(() => {
    if (chimeSynced.current) return;
    const fromServer = parseSaleChimeId(info?.sale_chime);
    if (!fromServer) return;
    chimeSynced.current = true;
    setChime(fromServer);
    setSaleChimeSound(fromServer);
  }, [info?.sale_chime]);

  useEffect(() => {
    let cancelled = false;
    void hasLocalWebPushSubscription().then((on) => {
      if (!cancelled) setPhonePushOn(on);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = emailField.trim();
      if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw new Error(t("pages.networkSales.invalidEmail"));
      }
      const { error: err } = await integrationsService.patchNotificationEmail(trimmed, chime);
      if (err) throw new Error(err);
    },
    onSuccess: async () => {
      toast.success(t("pages.networkSales.saved"));
      await queryClient.invalidateQueries({ queryKey: ["integrations-affiliate-webhook-info"] });
      await refreshUser();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.testSaleEmail();
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        fill(t("pages.networkSales.testEmail"), {
          to: data?.sent_to ?? t("pages.networkSales.testEmailFallback"),
        }),
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activatePhone = useMutation({
    mutationFn: async () => {
      const r = await subscribeToWebPush();
      if (r.ok === false) throw new Error(r.error);
    },
    onSuccess: () => {
      setPhonePushOn(true);
      toast.success(t("pages.networkSales.phoneOn"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testPhone = useMutation({
    mutationFn: async () => {
      const { error: err } = await integrationsService.testWebPush();
      if (err) throw new Error(err);
    },
    onSuccess: () => {
      toast.success(t("pages.networkSales.phoneTest"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredPlatforms = AFFILIATE_PLATFORMS.filter((p) => p.toLowerCase().includes(filter.toLowerCase()));

  /** Base do webhook com HTTPS garantido no browser (produção). */
  const displayHookUrl = useMemo(
    () => (info?.hook_url ? ensureHttpsWebhookUrl(info.hook_url) : ""),
    [info?.hook_url],
  );

  const handleCopyHook = useCallback(() => {
    if (!displayHookUrl) return;
    navigator.clipboard.writeText(displayHookUrl);
    setCopied(true);
    toast.success(t("pages.networkSales.hookCopied"));
    setTimeout(() => setCopied(false), 2000);
  }, [displayHookUrl, t]);

  /** Exemplo alinhado à plataforma escolhida (macros + parâmetros que o servidor lê). */
  const examplePostbackUrl = useMemo(() => {
    if (!displayHookUrl) return "";
    return buildAffiliatePostbackExampleUrl(displayHookUrl, selected);
  }, [displayHookUrl, selected]);

  const postbackPresetHint = useMemo(() => getAffiliatePostbackPreset(selected).hint, [selected]);
  const funnelGuide = useMemo(() => getAffiliateFunnelGuide(selected), [selected]);
  const selectedTier = useMemo(() => getAffiliatePlatformDef(selected)?.tier ?? null, [selected]);
  const funnelAssets = info?.funnel ?? info?.buygoods_funnel_pixels ?? null;

  const checkoutEventUrl = useMemo(() => {
    const raw = info?.funnel?.checkout_event_postback_url || "";
    if (!raw) return "";
    const base = raw.split("&funnel_step=")[0] || raw;
    return buildAffiliateFunnelEventUrl(base, selected, "checkout");
  }, [info?.funnel?.checkout_event_postback_url, selected]);

  const handleCopyExample = useCallback(() => {
    if (!examplePostbackUrl) return;
    navigator.clipboard.writeText(examplePostbackUrl);
    setCopiedExample(true);
    toast.success(t("pages.networkSales.noticeCopied"));
    setTimeout(() => setCopiedExample(false), 2000);
  }, [examplePostbackUrl]);

  const handleCopyFunnel = useCallback(
    (kind: "checkout" | "lander" | "checkout_event") => {
      let text = "";
      if (kind === "checkout") text = funnelAssets?.checkout_html || "";
      else if (kind === "lander") text = funnelAssets?.lander_html || "";
      else text = checkoutEventUrl;
      if (!text) return;
      void navigator.clipboard.writeText(text);
      setCopiedFunnel(kind);
      const msgs = {
        checkout: fill(t("pages.networkSales.pixelCheckout"), { path: funnelGuide.panelPath }),
        lander: fill(t("pages.networkSales.pixelLander"), { path: funnelGuide.panelPath }),
        checkout_event: fill(t("pages.networkSales.pixelEvent"), { platform: selected }),
      } as const;
      toast.success(msgs[kind]);
      setTimeout(() => setCopiedFunnel(null), 2000);
    },
    [checkoutEventUrl, funnelAssets?.checkout_html, funnelAssets?.lander_html, funnelGuide.panelPath, selected, t],
  );

  const testPostback = useMutation({
    mutationFn: async () => {
      const { data, error } = await integrationsService.testAffiliatePostback(selected);
      if (error) throw new Error(error);
      if (!data) throw new Error(t("pages.networkSales.emptyResponse"));
      return data;
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(data.message || t("pages.networkSales.linkOk"));
      } else {
        toast.error(data.error || data.message || t("pages.networkSales.testFailed"));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) return <LoadingState message={t("pages.networkSales.loadingSession")} />;

  if (!canReadSecrets) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <ProPageHeader
          title={t("pages.networkSales.title")}
          subtitle={t("pages.networkSales.subtitleShort")}
        />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-4 py-4 text-sm text-foreground">
          <p className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            {t("pages.presells.noPermission")}
          </p>
          <p className="mt-2 text-muted-foreground text-xs leading-relaxed">
            {t("pages.networkSales.readOnly")}
          </p>
        </div>
      </div>
    );
  }

  if (hookPlanDenied) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <ProPageHeader
          title={t("pages.networkSales.title")}
          subtitle={t("pages.networkSales.subtitleShort")}
        />
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-4 py-4 text-sm text-foreground space-y-2">
          <p className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            {t("pages.networkSales.planOff")}
          </p>
          <p className="text-muted-foreground leading-relaxed text-xs">
            {t("pages.networkSales.planOffHint")}
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/planos">{t("pages.conversions.viewPlans")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingState message={t("pages.networkSales.loading")} />;
  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : t("common.loadFailed")}
        onRetry={() => refetch()}
      />
    );
  }

  if (!info) return <ErrorState message={t("common.emptyTitle")} onRetry={() => refetch()} />;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.networkSales.title")}
        subtitle={t("pages.networkSales.subtitle")}
      />

      {intLocked ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-100/90 mb-4">
          {t("pages.networkSales.readOnly")}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 sm:p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ListOrdered className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-base font-semibold text-foreground">{t("pages.networkSales.setupTitle")}</h2>
        </div>
        <ol className="list-decimal list-outside space-y-2.5 pl-5 text-sm text-muted-foreground leading-relaxed marker:font-semibold marker:text-foreground">
          <li>
            {t("pages.networkSales.pickNetwork")}
          </li>
          <li>
            <strong className="text-foreground/90">{t("pages.networkSales.salesStep")}</strong> {t("pages.networkSales.salesStepBody")}
          </li>
          <li>
            <strong className="text-foreground/90">{t("pages.networkSales.checkoutStep")}</strong> {t("pages.networkSales.checkoutStepBody")}
          </li>
          <li>
            {t("pages.networkSales.pageStep")}
          </li>
          <li>
            {t("pages.networkSales.whereItLands")}
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border/50 pt-3">
          {t("pages.networkSales.untrackedStillSaved")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card shadow-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("pages.networkSales.filterNetworks")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
              {t("pages.networkSales.catalogHint")}
            </p>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {filteredPlatforms.map((platform) => {
              const tier = getAffiliatePlatformDef(platform)?.tier;
              return (
              <button
                key={platform}
                type="button"
                onClick={() => setSelected(platform)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-border/30 last:border-0 ${
                  selected === platform
                    ? "gradient-primary text-primary-foreground font-medium"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{platform}</span>
                  {tier ? (
                    <span
                      className={`shrink-0 text-[10px] font-medium uppercase tracking-wide ${
                        selected === platform ? "opacity-90" : "text-muted-foreground"
                      }`}
                    >
                      {tier === "native" ? t("pages.networkSales.tierNative") : "S2S"}
                    </span>
                  ) : null}
                </span>
              </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card space-y-5">
            <div>
              <h2 className="text-lg font-bold text-card-foreground">
                <span className="text-muted-foreground font-normal text-sm uppercase tracking-wider">{t("pages.networkSales.networkParam")}</span>{" "}
                {selected}
                {selectedTier ? (
                  <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
                    {selectedTier === "native" ? t("pages.networkSales.tierParser") : t("pages.networkSales.tierS2s")}
                  </span>
                ) : null}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("pages.networkSales.followCard")}{" "}
                <strong className="text-foreground/90">{selected}</strong>
                {t("pages.networkSales.followCardTail")}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {t("pages.networkSales.emailLabel")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("pages.networkSales.emailFallback")} <span className="font-mono text-[11px]">{info.fallback_account_email}</span>
                . {t("pages.networkSales.emailHint")}
              </p>
              <Input
                type="email"
                placeholder={info.fallback_account_email || "seu@email.com"}
                value={emailField}
                readOnly={intLocked}
                onChange={(e) => setEmailField(e.target.value)}
              />
              <Button
                type="button"
                className="gap-2"
                onClick={() => saveMutation.mutate()}
                disabled={intLocked || saveMutation.isPending}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("pages.networkSales.saveEmail")}
              </Button>
            </div>

            <div className="space-y-3">
              <Label className="font-semibold">{t("pages.networkSales.chimeLabel")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("pages.networkSales.chimeHint")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("pages.networkSales.chimeLabel")}>
                {SALE_CHIMES.map((item) => {
                  const selectedSound = chime === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selectedSound}
                      disabled={intLocked}
                      onClick={() => {
                        setChime(item.id);
                        setSaleChimeSound(item.id);
                        void playSaleChime(item.id);
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        selectedSound ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <span className="block text-sm font-medium text-foreground">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {t("pages.networkSales.phoneTitle")}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("pages.networkSales.phoneCard")} {t("pages.networkSales.phoneCardBody")}
              </p>
              {phoneSupport === "ios-home" ? (
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4">
                  <li>{t("pages.networkSales.iosShare")}</li>
                  <li>{t("pages.networkSales.addHome")}</li>
                  <li>{t("pages.networkSales.openIcon")}</li>
                </ol>
              ) : phoneSupport === "unsupported" ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("pages.networkSales.noInstall")}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("pages.networkSales.tapActivate")}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  disabled={intLocked || phoneSupport !== "ready" || phonePushOn === true || activatePhone.isPending}
                  onClick={() => activatePhone.mutate()}
                >
                  {activatePhone.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  {phonePushOn ? t("pages.networkSales.phoneOnLabel") : t("pages.networkSales.phoneActivate")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={intLocked || !phonePushOn || testPhone.isPending}
                  onClick={() => testPhone.mutate()}
                >
                  {testPhone.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("pages.networkSales.sendTest")}
                </Button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border-2 border-primary/40 bg-primary/[0.06] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="font-semibold text-foreground text-base">
                  {fill(t("pages.networkSales.pasteIn"), { network: selected })}
                </Label>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {t("pages.networkSales.useThis")}
                </span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {t("pages.networkSales.copyNoticeLead")}{" "}
                {selected === "BuyGoods" ? (
                  <strong>{t("pages.networkSales.pasteBuygoods")}</strong>
                ) : selected === "SmartAdv" ? (
                  <>{t("pages.networkSales.pasteSmart")}</>
                ) : (
                  <>{fill(t("pages.networkSales.pastePanel"), { network: selected })}</>
                )}
                . {t("pages.networkSales.macrosHint")}
              </p>
              <p className="text-xs text-foreground/90 leading-snug rounded-lg bg-background/80 border border-border/50 px-3 py-2">
                <span className="font-semibold text-foreground">{selected}:</span> {postbackPresetHint}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:flex-wrap">
                <Input readOnly value={examplePostbackUrl} className="font-mono text-[11px] leading-snug bg-background h-auto min-h-[3rem] py-2 flex-1 min-w-[12rem]" />
                <Button type="button" className="gap-2 shrink-0 sm:self-start" onClick={handleCopyExample}>
                  {copiedExample ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {t("pages.networkSales.copyNotice")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 shrink-0 sm:self-start"
                  disabled={intLocked || testPostback.isPending}
                  onClick={() => testPostback.mutate()}
                >
                  {testPostback.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {t("pages.networkSales.testLink")}
                </Button>
              </div>
              <PostbackMacroChecklist postbackUrl={examplePostbackUrl} platform={selected} />
              {testPostback.data ? (
                <div
                  className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                    testPostback.data.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
                      : "border-amber-500/30 bg-amber-500/10 text-foreground"
                  }`}
                >
                  <p className="font-medium">
                    {testPostback.data.ok ? t("pages.networkSales.testResult") : t("pages.networkSales.attention")}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {testPostback.data.message || testPostback.data.error}
                  </p>
                  {testPostback.data.next_step ? (
                    <p className="mt-1 text-muted-foreground">{t("pages.networkSales.nextStep")} {testPostback.data.next_step}</p>
                  ) : null}
                  {testPostback.data.conversion ? (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      conversion={testPostback.data.conversion}
                      {testPostback.data.attribution ? ` · attribution=${testPostback.data.attribution}` : ""}
                      {testPostback.data.click_id ? ` · click=${testPostback.data.click_id.slice(0, 8)}…` : ""}
                    </p>
                  ) : null}
                  {testPostback.data.ok ? (
                    <Button variant="link" className="h-auto px-0 mt-1 text-xs" asChild>
                      <Link to="/resultados/conversoes">{t("pages.networkSales.viewConversions")}</Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide">{t("pages.networkSales.validateTitle")}</p>
                <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                  <li>
                    {fill(t("pages.networkSales.validatePaste"), { network: selected })}
                  </li>
                  <li>
                    {t("pages.networkSales.test1")}
                  </li>
                  <li>
                    {fill(t("pages.networkSales.test2"), { network: selected })}
                  </li>
                  <li>
                    {t("pages.networkSales.test3")}
                  </li>
                </ol>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("pages.networkSales.networkParam")} <span className="font-medium text-foreground/90">{selected}</span> → {t("pages.networkSales.paramWord")}{" "}
                <span className="font-mono">platform=…</span> nos alertas.
              </p>
            </div>

            {funnelAssets ? (
              <div className="space-y-4 rounded-xl border border-border/60 bg-muted/15 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label className="font-semibold text-foreground text-base">
                      {t("pages.networkSales.funnelTitle")}
                    </Label>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {funnelGuide.mode === "html_funnel_pixels"
                        ? t("pages.networkSales.pixelHtml")
                        : funnelGuide.mode === "event_postback"
                          ? t("pages.networkSales.eventNotice")
                          : t("pages.networkSales.saleOnly")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{funnelGuide.summary}</p>
                  <p className="mt-1 text-xs text-foreground/80">
                    {t("pages.networkSales.whereConfig")} <span className="font-medium">{funnelGuide.panelPath}</span>
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed border-t border-border/40 pt-2">
                    {t("pages.networkSales.alwaysAvailable")}
                  </p>
                </div>

                {funnelGuide.mode === "html_funnel_pixels" || funnelGuide.mode === "sale_only" ? (
                  <div className="space-y-3">
                    {funnelGuide.mode === "sale_only" ? (
                      <p className="text-xs text-amber-900/90 dark:text-amber-100/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 leading-relaxed">
                        {t("pages.networkSales.noCheckoutDocs")}
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t("pages.networkSales.htmlCheckout")}</Label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <Input
                          readOnly
                          value={funnelAssets.checkout_html}
                          className="font-mono text-[10px] leading-snug bg-background h-auto min-h-[2.75rem] py-2 flex-1"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          className="gap-2 shrink-0"
                          disabled={intLocked}
                          onClick={() => handleCopyFunnel("checkout")}
                        >
                          {copiedFunnel === "checkout" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {t("pages.networkSales.copyCheckout")}
                        </Button>
                      </div>
                    </div>
                    {(funnelGuide.supportsLander || funnelGuide.mode === "sale_only") && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">{t("pages.networkSales.htmlLander")}</Label>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                          <Input
                            readOnly
                            value={funnelAssets.lander_html}
                            className="font-mono text-[10px] leading-snug bg-background h-auto min-h-[2.75rem] py-2 flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2 shrink-0"
                            disabled={intLocked}
                            onClick={() => handleCopyFunnel("lander")}
                          >
                            {copiedFunnel === "lander" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {t("pages.networkSales.copyLander")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

                {funnelGuide.mode === "event_postback" && checkoutEventUrl ? (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {t("pages.networkSales.checkoutUrl")}
                    </Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <Input
                        readOnly
                        value={checkoutEventUrl}
                        className="font-mono text-[10px] leading-snug bg-background h-auto min-h-[2.75rem] py-2 flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="gap-2 shrink-0"
                        disabled={intLocked}
                        onClick={() => handleCopyFunnel("checkout_event")}
                      >
                        {copiedFunnel === "checkout_event" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {t("pages.networkSales.copyEvent")}
                      </Button>
                    </div>
                    {funnelGuide.eventClickIdMacro ? (
                      <p className="text-[11px] text-muted-foreground">
                        {t("pages.networkSales.clickMacro")}{" "}
                        <span className="font-mono text-foreground/85">{funnelGuide.eventClickIdMacro}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t("pages.networkSales.funnelLead")}{" "}
                  <Link to="/resultados/relatorios/acessos" className="text-primary underline-offset-2 hover:underline">
                    {t("pages.networkSales.reportsVisits")}
                  </Link>{" "}
                  {t("pages.networkSales.asCheckout")}
                </p>
              </div>
            ) : null}

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-0 h-auto text-muted-foreground gap-1">
                  {t("pages.networkSales.otherUrl")}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-3">
                <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-4">
                  <Label className="font-semibold text-muted-foreground">{t("pages.networkSales.baseToken")}</Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("pages.networkSales.baseTokenHint")}{" "}
                    <span className="font-mono">{"{SUBID}"}</span>, <span className="font-mono">{"{ORDERID}"}</span>, etc.{" "}
                    {t("pages.networkSales.baseTokenTail")}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <Input readOnly value={displayHookUrl} className="font-mono text-xs bg-muted/30 h-11 sm:h-10 opacity-90" />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={handleCopyHook} title={t("pages.networkSales.copyHookTitle")}>
                        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 shrink-0"
                        onClick={() => testMutation.mutate()}
                        disabled={intLocked || testMutation.isPending || !info.smtp_configured}
                      >
                        {testMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        {t("pages.networkSales.testEmailBtn")}
                      </Button>
                    </div>
                  </div>
                  {!info.smtp_configured && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      {isAdmin ? (
                        <>
                          {t("pages.networkSales.smtpMissing")}
                        </>
                      ) : (
                        <>{t("pages.networkSales.emailUnavailable")}</>
                      )}
                    </p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>
                    {t("pages.networkSales.adsOtherFlow")}{" "}
                    <Link to="/tracking/tools" className="text-primary inline-flex items-center gap-1 hover:underline">
                      {t("pages.integrations.openTracking")} <ExternalLink className="h-3 w-3" />
                    </Link>
                    .
                  </p>
                  {isAdmin ? (
                    <p>
                      {t("pages.networkSales.hotmartOther")}{" "}
                      <span className="font-mono">/api/webhooks/hotmart</span> {t("pages.networkSales.hotmartTail")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
