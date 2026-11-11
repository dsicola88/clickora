import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Copy,
  Check,
  Send,
  Save,
  Loader2,
  Radio,
  MessageCircle,
  CloudUpload,
  ArrowRight,
  Bell,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { analyticsService } from "@/services/analyticsService";
import { integrationsService } from "@/services/integrationsService";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import {
  subscribeToWebPush,
  unsubscribeFromWebPush,
  hasLocalWebPushSubscription,
} from "@/lib/webPushClient";
import { playSaleChime, saleChimeEnabled, setSaleChimeEnabled } from "@/lib/saleChime";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { GOOGLE_ADS_OFFLINE_CLICK_IMPORT_HELP_URL } from "@/lib/googleAdsOfflineImport";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

function SectionShell({
  accent,
  children,
  className,
}: {
  accent: "primary" | "accent" | "success" | "violet";
  children: ReactNode;
  className?: string;
}) {
  const ring =
    accent === "primary"
      ? "border-l-primary"
      : accent === "accent"
        ? "border-l-accent"
        : accent === "violet"
          ? "border-l-violet-500"
          : "border-l-success";
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 shadow-sm border-l-4 backdrop-blur-sm",
        ring,
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function Integrations() {
  const { t } = useAppLocale();
  const queryClient = useQueryClient();
  const apiBase = getApiBaseUrl();
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const intLocked = !userCanWriteIntegrations(user);

  const [copiedCsv, setCopiedCsv] = useState(false);
  const [telegramTokenDraft, setTelegramTokenDraft] = useState("");
  const [telegramChatDraft, setTelegramChatDraft] = useState("");
  const [notifySale, setNotifySale] = useState(true);
  const [notifyPostback, setNotifyPostback] = useState(true);
  const [notifyClick, setNotifyClick] = useState(false);
  const [discordWebhook, setDiscordWebhook] = useState("");

  const { data: dashboard } = useQuery({
    queryKey: ["integrations-dashboard-install"],
    queryFn: async () => {
      const { data, error: err } = await analyticsService.getDashboard();
      if (err) throw new Error(err);
      return data;
    },
  });

  const csvUploadUrl = useMemo(() => {
    const raw = dashboard?.tracking_install?.csv_upload_url ?? "";
    if (!raw) return "";
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const onLocalDev = host === "localhost" || host === "127.0.0.1";
      const apiIsRemote = !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(apiBase);
      if (!onLocalDev && apiIsRemote && /localhost|127\.0\.0\.1/.test(raw)) {
        try {
          const u = new URL(raw);
          const token = u.searchParams.get("token");
          if (token) {
            const base = apiBase.replace(/\/$/, "");
            return `${base}/track/conversions/csv?token=${encodeURIComponent(token)}`;
          }
        } catch {
          /* ignore */
        }
      }
    }
    return raw;
  }, [dashboard?.tracking_install?.csv_upload_url, apiBase]);

  const { data: telegram, isLoading: telegramLoading } = useQuery({
    queryKey: ["integrations-telegram"],
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getTelegramSettings();
      if (err) throw new Error(err);
      if (!data) throw new Error(t("pages.integrations.emptyResponse"));
      return data;
    },
  });

  useEffect(() => {
    if (!telegram) return;
    setTelegramChatDraft(telegram.telegram_chat_id);
    setNotifySale(telegram.telegram_notify_sale);
    setNotifyPostback(telegram.telegram_notify_postback_error);
    setNotifyClick(telegram.telegram_notify_click);
    setTelegramTokenDraft("");
  }, [telegram]);

  const saveTelegram = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.patchTelegramSettings({
        ...(telegramTokenDraft.trim() ? { telegram_bot_token: telegramTokenDraft.trim() } : {}),
        telegram_chat_id: telegramChatDraft,
        telegram_notify_sale: notifySale,
        telegram_notify_postback_error: notifyPostback,
        telegram_notify_click: notifyClick,
      });
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: async () => {
      toast.success(t("pages.integrations.telegramSaved"));
      setTelegramTokenDraft("");
      await queryClient.invalidateQueries({ queryKey: ["integrations-telegram"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearTelegramToken = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.patchTelegramSettings({
        clear_telegram_bot_token: true,
      });
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: async () => {
      toast.success(t("pages.integrations.telegramTokenCleared"));
      await queryClient.invalidateQueries({ queryKey: ["integrations-telegram"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testTelegram = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.testTelegramIntegration();
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: () => toast.success(t("pages.integrations.telegramTestSent")),
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: webPush, isLoading: webPushLoading } = useQuery({
    queryKey: ["integrations-web-push"],
    queryFn: async () => {
      const { data, error: err } = await integrationsService.getWebPushConfig();
      if (err) throw new Error(err);
      if (!data) throw new Error(t("pages.integrations.emptyResponse"));
      return data;
    },
  });

  /** null = a sincronizar com o browser; só este dispositivo (PushManager). */
  const [localPushOn, setLocalPushOn] = useState<boolean | null>(null);
  const [saleChimeOn, setSaleChimeOn] = useState(() => saleChimeEnabled());

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      if (webPushLoading || !webPush) return;
      if (!webPush.configured) {
        setLocalPushOn(false);
        return;
      }
      setLocalPushOn(null);
      const on = await hasLocalWebPushSubscription();
      if (!cancelled) setLocalPushOn(on);
    }
    void sync();
    return () => {
      cancelled = true;
    };
  }, [webPushLoading, webPush]);

  const pushUiReady = Boolean(webPush?.configured && localPushOn !== null);
  const isLocalPushOn = localPushOn === true;

  const activateWebPush = useMutation({
    mutationFn: async () => {
      const r = await subscribeToWebPush();
      if (r.ok === false) throw new Error(r.error);
      return r;
    },
    onSuccess: async () => {
      toast.success(t("pages.integrations.pushOn"));
      setLocalPushOn(true);
      await queryClient.invalidateQueries({ queryKey: ["integrations-web-push"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateWebPush = useMutation({
    mutationFn: async () => {
      const r = await unsubscribeFromWebPush();
      if (r.ok === false) throw new Error(r.error);
      return r;
    },
    onSuccess: async () => {
      toast.success(t("pages.integrations.pushOff"));
      setLocalPushOn(false);
      await queryClient.invalidateQueries({ queryKey: ["integrations-web-push"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testWebPush = useMutation({
    mutationFn: async () => {
      const { data, error: err } = await integrationsService.testWebPush();
      if (err) throw new Error(err);
      return data;
    },
    onSuccess: () => toast.success(t("pages.integrations.pushTest")),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCopyCsv = () => {
    if (!csvUploadUrl) return;
    navigator.clipboard.writeText(csvUploadUrl);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
    toast.success(t("pages.integrations.urlCopied"));
  };

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        centered
        title={t("pages.integrations.title")}
        description={
          isAdmin ? t("pages.integrations.legacyAdminDesc") : t("pages.integrations.legacyUserDesc")
        }
      />

      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border/60 bg-muted/15 px-4 py-4 sm:px-5 space-y-3">
        <p className="text-sm font-medium text-foreground">{t("pages.integrations.otherLinksTitle")}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{t("pages.integrations.otherLinksBody")}</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button variant="outline" size="sm" className="justify-between gap-2 sm:flex-1" asChild>
            <Link to="/tracking/tools">
              {t("pages.integrations.openTracking")}
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="justify-between gap-2 sm:flex-1" asChild>
            <Link to="/tracking/plataformas">
              {t("nav.networkSales")}
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
            </Link>
          </Button>
        </div>
      </div>

      {intLocked ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm text-amber-950/90 dark:text-amber-100/90 mb-4 max-w-3xl mx-auto">
          {t("pages.integrations.readOnly")}
        </div>
      ) : null}

      <Accordion type="multiple" defaultValue={["webpush", "google", "telegram"]} className="space-y-4">
        <AccordionItem value="webpush" className="border-0">
          <SectionShell accent="violet">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:border-b border-border/50">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-700 dark:text-violet-400">
                  <Bell className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t("pages.integrations.pushTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.integrations.pushLead")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2 space-y-4">
              {webPushLoading || !webPush ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("pages.integrations.loadingShort")}
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 space-y-2">
                    <p className="text-sm font-medium text-foreground">{t("pages.integrations.stepsTitle")}</p>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5 marker:text-foreground/80">
                      <li>
                        {t("pages.integrations.stepAccept")}
                      </li>
                      <li>
                        {t("pages.integrations.stepSale")}
                      </li>
                      <li>
                        {t("pages.integrations.stepIphone")}
                      </li>
                    </ol>
                  </div>

                  {!webPush.configured ? (
                    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-sm text-muted-foreground leading-relaxed">
                      {isSuperAdmin ? (
                        <>
                          {t("pages.integrations.adminVapid")}{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">VAPID_KEYS_JSON</code>{" "}
                          {t("pages.integrations.adminJsonLine")}{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-[10px] break-all">
                            {`{"public":"…","private":"…"}`}
                          </code>{" "}
                          {t("pages.integrations.adminValuesFrom")}{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">npx web-push generate-vapid-keys</code>
                          ). {t("pages.integrations.adminRedeploy")}{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">VAPID_SUBJECT</code>{" "}
                          {t("pages.integrations.adminService")}{" "}
                          <strong className="font-medium text-foreground/90">clickora</strong> (API).{" "}
                          <Link to="/admin" className="font-medium text-primary hover:underline">
                            {t("pages.integrations.adminPanel")}
                          </Link>
                          .
                        </>
                      ) : (
                        <>
                          {t("pages.integrations.pushNotLive")}
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("pages.integrations.devicesLinked")}{" "}
                      <span className="font-medium text-foreground">{webPush.subscription_count}</span>{" "}
                      {t("pages.integrations.subCountTail")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={
                        intLocked || !pushUiReady || isLocalPushOn || activateWebPush.isPending
                      }
                      onClick={() => activateWebPush.mutate()}
                    >
                      {activateWebPush.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                      {t("pages.integrations.activateDevice")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={
                        intLocked || !pushUiReady || !isLocalPushOn || deactivateWebPush.isPending
                      }
                      onClick={() => deactivateWebPush.mutate()}
                    >
                      {deactivateWebPush.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {t("pages.integrations.deactivateDevice")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={intLocked || !pushUiReady || !isLocalPushOn || testWebPush.isPending}
                      onClick={() => testWebPush.mutate()}
                    >
                      {testWebPush.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {t("pages.integrations.testShort")}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{t("pages.integrations.saleChime")}</p>
                        <p className="text-sm text-muted-foreground">{t("pages.integrations.saleChimeDesc")}</p>
                      </div>
                      <Switch
                        checked={saleChimeOn}
                        disabled={intLocked}
                        onCheckedChange={(on) => {
                          setSaleChimeEnabled(on);
                          setSaleChimeOn(on);
                        }}
                        aria-label={t("pages.integrations.saleChime")}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      disabled={intLocked || !saleChimeOn}
                      onClick={() => {
                        void playSaleChime().then((ok) => {
                          if (!ok) toast.error(t("pages.integrations.saleChimeBlocked"));
                        });
                      }}
                    >
                      {t("pages.integrations.saleChimeListen")}
                    </Button>
                  </div>
                </>
              )}
            </AccordionContent>
          </SectionShell>
        </AccordionItem>

        <AccordionItem value="google" className="border-0">
          <SectionShell accent="primary">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:border-b border-border/50">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <CloudUpload className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">{t("pages.integrations.googleSendTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.integrations.googleSendBody")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                {isAdmin ? (
                  <>
                    {t("pages.integrations.googlePaste")}{" "}
                    <Link
                      to="/integracoes/google-ads"
                      className="font-medium text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      {t("pages.integrations.googleLink")}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    {t("pages.integrations.googlePasteShort")}{" "}
                    <Link
                      to="/integracoes/google-ads"
                      className="font-medium text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      {t("pages.integrations.googleLink")}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    .
                  </>
                )}
              </p>

              <div className="space-y-2">
                <Label htmlFor="csv-url">{t("pages.integrations.uploadUrl")}</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <Input
                    id="csv-url"
                    readOnly
                    value={csvUploadUrl || t("pages.integrations.loadingShort")}
                    className="font-mono text-xs sm:text-sm bg-muted/30"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 gap-2 sm:min-w-[8rem]"
                    disabled={!csvUploadUrl}
                    onClick={handleCopyCsv}
                  >
                    {copiedCsv ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {t("pages.integrations.copy")}
                  </Button>
                </div>
              </div>

              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
                <li>
                  {t("pages.integrations.csvWhere")}{" "}
                  <strong className="text-foreground/90">{t("pages.integrations.csvReports")}</strong>
                  {t("pages.integrations.csvName")}
                </li>
                <li>{t("pages.integrations.csvPost")}</li>
                <li>{t("pages.integrations.csvBrowser")}</li>
                <li>
                  Formato e requisitos:{" "}
                  <a
                    href={GOOGLE_ADS_OFFLINE_CLICK_IMPORT_HELP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    {t("pages.integrations.googleDocs")}
                  </a>
                  .
                </li>
              </ul>
            </AccordionContent>
          </SectionShell>
        </AccordionItem>

        <AccordionItem value="discord" className="border-0">
          <SectionShell accent="accent">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:border-b border-border/50">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Radio className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Discord</p>
                  <p className="text-sm text-muted-foreground">{t("pages.integrations.webhooksPreview")}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                {isAdmin ? (
                  <>
                    {t("pages.integrations.discordSoon")}
                  </>
                ) : (
                  <>{t("pages.integrations.discordLater")}</>
                )}
              </p>
              <div className="space-y-2">
                <Label htmlFor="discord-hook">{t("pages.integrations.webhookUrl")}</Label>
                <Input
                  id="discord-hook"
                  placeholder="https://discord.com/api/webhooks/…"
                  value={discordWebhook}
                  onChange={(e) => setDiscordWebhook(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => toast.message(t("pages.integrations.draftLocal"))}
              >
                <Save className="h-4 w-4" /> {t("pages.integrations.saveDraft")}
              </Button>
            </AccordionContent>
          </SectionShell>
        </AccordionItem>

        <AccordionItem value="telegram" className="border-0">
          <SectionShell accent="success">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]]:border-b border-border/50">
              <div className="flex items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-foreground">Telegram</p>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.integrations.telegramLive")}
                  </p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-5 pt-2 space-y-5">
              {telegramLoading || !telegram ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("pages.integrations.loadingShort")}
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 space-y-3">
                    <p className="text-sm font-medium text-foreground">{t("pages.integrations.stepByStep")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("pages.integrations.telegramReadyBody")}
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-2.5 list-decimal pl-5 marker:text-foreground/80">
                      <li className="pl-1">
                        {t("pages.integrations.botFatherNew")}
                      </li>
                      <li className="pl-1">
                        {t("pages.integrations.botTokenPaste")}
                      </li>
                      <li className="pl-1">
                        {t("pages.integrations.botFatherHint")} {t("pages.integrations.botFatherStart")}
                      </li>
                      <li className="pl-1">
                        {t("pages.integrations.chatIdHow")} {t("pages.integrations.chatIdGroup")}
                      </li>
                      <li className="pl-1">
                        {t("pages.integrations.saveAlerts")}
                      </li>
                      <li className="pl-1">
                        {t("pages.integrations.testHint")}
                      </li>
                    </ol>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tg-token">{t("pages.integrations.botTokenLabel")}</Label>
                      <Input
                        id="tg-token"
                        type="password"
                        autoComplete="off"
                        placeholder={telegram.has_bot_token ? t("pages.integrations.tokenPlaceholder") : "123456:ABC…"}
                        value={telegramTokenDraft}
                        readOnly={intLocked}
                        onChange={(e) => setTelegramTokenDraft(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("pages.integrations.tokenHint")}
                      </p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="tg-chat">Chat ID</Label>
                      <Input
                        id="tg-chat"
                        placeholder="-1001234567890"
                        value={telegramChatDraft}
                        readOnly={intLocked}
                        onChange={(e) => setTelegramChatDraft(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 space-y-3">
                    <p className="text-sm font-medium text-foreground">{t("pages.integrations.notifyTitle")}</p>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">{t("pages.integrations.notifySale")}</span>
                      <Switch checked={notifySale} disabled={intLocked} onCheckedChange={setNotifySale} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">{t("pages.integrations.notifyPostback")}</span>
                      <Switch checked={notifyPostback} disabled={intLocked} onCheckedChange={setNotifyPostback} />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">{t("pages.integrations.notifyClick")}</span>
                      <Switch checked={notifyClick} disabled={intLocked} onCheckedChange={setNotifyClick} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="gap-2"
                      disabled={intLocked || saveTelegram.isPending}
                      onClick={() => saveTelegram.mutate()}
                    >
                      {saveTelegram.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {t("pages.integrations.save")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="gap-2"
                      disabled={intLocked || !telegram.telegram_configured || testTelegram.isPending}
                      onClick={() => testTelegram.mutate()}
                    >
                      {testTelegram.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {t("pages.integrations.test")}
                    </Button>
                    {telegram.has_bot_token ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/5"
                        disabled={intLocked || clearTelegramToken.isPending}
                        onClick={() => clearTelegramToken.mutate()}
                      >
                        {t("pages.integrations.removeToken")}
                      </Button>
                    ) : null}
                  </div>

                  {telegram.telegram_configured ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">{t("pages.integrations.telegramReady")}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("pages.integrations.fillToEnable")}</p>
                  )}
                </>
              )}
            </AccordionContent>
          </SectionShell>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
