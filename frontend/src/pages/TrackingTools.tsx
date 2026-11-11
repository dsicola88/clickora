import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { fill, numberLocaleFor, type MessageKey } from "@/i18n";
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, NavLink, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  Key,
  Copy,
  Check,
  Globe,
  Loader2,
  Smartphone,
  Fingerprint,
  Send,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { trackingService } from "@/services/trackingService";
import { analyticsService } from "@/services/analyticsService";
import { presellService } from "@/services/presellService";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { countryDisplayLabel, countryFlagEmoji } from "@/lib/countryDisplay";
import { cn } from "@/lib/utils";

const TOOLS_BASE = "/tracking/tools";

const navItems: { to: string; labelKey: MessageKey | null; literal?: string; icon: typeof MapPin }[] = [
  { to: `${TOOLS_BASE}/ip`, labelKey: "pages.trackingTools.navIp", icon: MapPin },
  { to: `${TOOLS_BASE}/gclid`, labelKey: null, literal: "GCLID", icon: Key },
  { to: `${TOOLS_BASE}/clique`, labelKey: "pages.trackingTools.clickId", icon: Fingerprint },
  { to: `${TOOLS_BASE}/postbacks`, labelKey: "pages.trackingTools.navPostbacks", icon: Globe },
];

function ToolsSubNav() {
  const { t } = useAppLocale();
  return (
    <nav className="mb-6 space-y-3" aria-label={t("pages.trackingTools.navAria")}>
      <p className="text-sm text-muted-foreground">{t("pages.trackingTools.navHint")}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {navItems.map(({ to, labelKey, literal, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors sm:min-w-0",
                isActive
                  ? "border-primary bg-primary/10 text-foreground font-medium shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {labelKey ? t(labelKey) : literal}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function IpLookupPage() {
  const { t } = useAppLocale();
  const [ip, setIp] = useState("");
  const [ipLoading, setIpLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [ipLookup, setIpLookup] = useState<{
    ip: string;
    found: boolean;
    network?: "CDN77" | "Fastly" | null;
    network_label?: string | null;
    visitor_located?: boolean;
    message?: string;
    geo?: {
      country_code: string;
      region: string;
      city: string;
      timezone: string;
      latitude: number | null;
      longitude: number | null;
      eu: boolean;
      metro: number;
      area_km: number;
    };
  } | null>(null);

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleTrackIp = async () => {
    const v = ip.trim();
    if (!v) {
      toast.error(t("pages.trackingTools.needIp"));
      return;
    }
    setIpLoading(true);
    setIpLookup(null);
    try {
      const { data, error } = await trackingService.lookupIp(v);
      if (error) throw new Error(error);
      if (!data || !data.ok) throw new Error(t("pages.trackingTools.badResponse"));
      setIpLookup({
        ip: data.ip,
        found: data.found,
        network: data.network ?? null,
        network_label: data.network_label ?? null,
        visitor_located: data.visitor_located === true,
        message: data.message,
        geo: data.geo,
      });
      if (data.network) {
        toast.info(
          fill(t("pages.trackingTools.networkNode"), { name: data.network_label ?? data.network }),
        );
      } else if (data.found) toast.info(t("pages.trackingTools.geoEstimate"));
      else toast.info(data.message || t("pages.trackingTools.noIpData"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("pages.trackingTools.ipFail"));
      setIpLookup(null);
    } finally {
      setIpLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
      <p className="text-sm text-muted-foreground">{t("pages.trackingTools.ipIntro")}</p>
      <div className="flex flex-col sm:flex-row items-end gap-4">
        <div className="space-y-2 flex-1">
          <Label>{t("pages.trackingTools.ipLabel")}</Label>
          <Input
            placeholder="Ex: 8.8.8.8"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTrackIp()}
          />
        </div>
        <Button
          type="button"
          onClick={handleTrackIp}
          disabled={ipLoading}
          className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
        >
          {ipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {ipLoading ? t("pages.trackingTools.lookingUp") : t("pages.trackingTools.track")}
        </Button>
      </div>

      {ipLookup ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-muted/30 p-5 space-y-2">
            <h3 className="font-semibold text-card-foreground flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> {t("pages.trackingTools.ipConsulted")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-medium text-card-foreground">{ipLookup.ip}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => copyText("ip-consultado", ipLookup.ip)}
              >
                {copiedField === "ip-consultado" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {t("pages.trackingTools.copyIp")}
              </Button>
            </div>
          </div>

          {ipLookup.network ? (
            <div className="rounded-xl border border-border/50 p-5 space-y-4 bg-card">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("pages.trackingTools.network")}</p>
                <p className="text-lg font-semibold text-foreground">
                  {ipLookup.network_label ?? ipLookup.network}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{ipLookup.message}</p>
              {ipLookup.geo ? (
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("pages.trackingTools.geoAside")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {[
                      {
                        label: t("pages.trackingTools.countryMarked"),
                        value: `${countryDisplayLabel(ipLookup.geo.country_code)} (${ipLookup.geo.country_code})`,
                      },
                      { label: t("pages.trackingTools.city"), value: ipLookup.geo.city || "—" },
                      { label: t("pages.trackingTools.timezone"), value: ipLookup.geo.timezone || "—" },
                      {
                        label: t("pages.trackingTools.coords"),
                        value:
                          ipLookup.geo.latitude != null && ipLookup.geo.longitude != null
                            ? `${ipLookup.geo.latitude.toFixed(4)}, ${ipLookup.geo.longitude.toFixed(4)}`
                            : "—",
                      },
                      {
                        label: t("pages.trackingTools.accuracyKm"),
                        value:
                          ipLookup.geo.area_km != null && ipLookup.geo.area_km > 0
                            ? String(ipLookup.geo.area_km)
                            : "—",
                      },
                    ].map((row) => (
                      <div key={row.label}>
                        <p className="text-xs text-muted-foreground">{row.label}</p>
                        <p className="font-medium text-foreground">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : !ipLookup.found ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-3">
              {ipLookup.message ??
                t("pages.trackingTools.noGeo")}
            </p>
          ) : ipLookup.geo ? (
            <div className="rounded-xl border border-border/50 p-5 space-y-4 bg-card">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl leading-none"
                  aria-hidden
                >
                  {countryFlagEmoji(ipLookup.geo.country_code)}
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("pages.trackingTools.geoBase")}
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {countryDisplayLabel(ipLookup.geo.country_code)}{" "}
                    <span className="text-sm font-mono font-normal text-muted-foreground">
                      ({ipLookup.geo.country_code})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ipLookup.message ??
                      t("pages.trackingTools.geoBaseHint")}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: t("pages.trackingTools.city"), value: ipLookup.geo.city || "—" },
                  { label: t("pages.trackingTools.regionCode"), value: ipLookup.geo.region || "—" },
                  { label: t("pages.trackingTools.timezone"), value: ipLookup.geo.timezone || "—" },
                  {
                    label: t("pages.trackingTools.coords"),
                    value:
                      ipLookup.geo.latitude != null && ipLookup.geo.longitude != null
                        ? `${ipLookup.geo.latitude.toFixed(4)}, ${ipLookup.geo.longitude.toFixed(4)}`
                        : "—",
                  },
                  { label: t("pages.trackingTools.eu"), value: ipLookup.geo.eu ? t("common.yes") : t("common.no") },
                  {
                    label: t("pages.trackingTools.accuracyKm"),
                    value:
                      ipLookup.geo.area_km != null && ipLookup.geo.area_km > 0
                        ? String(ipLookup.geo.area_km)
                        : "—",
                  },
                  ...(ipLookup.geo.metro > 0
                    ? [{ label: t("pages.trackingTools.metro"), value: String(ipLookup.geo.metro) }]
                    : []),
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="font-medium text-foreground">{row.value}</p>
                  </div>
                ))}
              </div>
              {ipLookup.geo.latitude != null && ipLookup.geo.longitude != null ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${ipLookup.geo.latitude}&mlon=${ipLookup.geo.longitude}&zoom=11`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {t("pages.trackingTools.viewMap")}
                    </a>
                  </Button>
                </div>
              ) : null}
              <div className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                <Smartphone className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
                <p>
                  <span className="font-medium text-foreground/90">{t("pages.trackingTools.deviceLead")}</span>{" "}
                  {t("pages.trackingTools.deviceMid")}{" "}
                  <span className="text-foreground/90">{t("pages.trackingTools.deviceReports")}</span>{" "}
                  {t("pages.trackingTools.deviceEnd")}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GclidDecoderPage() {
  const { t } = useAppLocale();
  const [gclidInput, setGclidInput] = useState("");
  const [loadingGclid, setLoadingGclid] = useState(false);
  const [gclidResult, setGclidResult] = useState<null | {
    campaignId: string;
    adGroupId: string;
    keyword: string;
    network: string;
  }>(null);

  const handleDecodeGclid = async () => {
    if (!gclidInput) {
      toast.error(t("pages.trackingTools.needGclid"));
      return;
    }
    setLoadingGclid(true);
    try {
      const { data, error } = await trackingService.lookupGclid(gclidInput);
      if (error || !data) throw new Error(error || t("pages.trackingTools.gclidMissing"));
      setGclidResult({
        campaignId: data.campaign || "N/A",
        adGroupId: data.medium || "N/A",
        keyword: data.utm_term || "N/A",
        network: data.source || "N/A",
      });
      toast.success(t("pages.trackingTools.gclidFound"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("pages.trackingTools.gclidFail"));
      setGclidResult(null);
    } finally {
      setLoadingGclid(false);
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
      <div className="flex flex-col sm:flex-row items-end gap-4">
        <div className="space-y-2 flex-1">
          <Label>GCLID</Label>
          <Input
            placeholder={t("pages.trackingTools.gclidPlaceholder")}
            value={gclidInput}
            onChange={(e) => setGclidInput(e.target.value)}
          />
        </div>
        <Button
          type="button"
          onClick={handleDecodeGclid}
          disabled={loadingGclid}
          className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
        >
          <Key className="h-4 w-4" /> {loadingGclid ? t("pages.trackingTools.consulting") : t("pages.trackingTools.decode")}
        </Button>
      </div>

      {gclidResult && (
        <div className="bg-muted/30 rounded-xl p-5 space-y-3 border border-border/50">
          <h3 className="font-semibold text-card-foreground">{t("pages.trackingTools.decoded")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Campaign ID", value: gclidResult.campaignId },
              { label: "Ad Group ID", value: gclidResult.adGroupId },
              { label: t("pages.trackingTools.keyword"), value: gclidResult.keyword },
              { label: t("pages.trackingTools.network"), value: gclidResult.network },
            ].map((item) => (
              <div key={item.label} className="bg-card rounded-lg p-3 border border-border/50">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium text-card-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClickUuidPage() {
  const { t } = useAppLocale();
  const [clickIdInput, setClickIdInput] = useState("");
  const [clickLookupLoading, setClickLookupLoading] = useState(false);
  const [clickLookup, setClickLookup] = useState<null | Record<string, unknown>>(null);

  const handleLookupClick = async () => {
    const id = clickIdInput.trim();
    if (!id) {
      toast.error(t("pages.trackingTools.needClickId"));
      return;
    }
    setClickLookupLoading(true);
    setClickLookup(null);
    try {
      const { data, error } = await analyticsService.getTrackingClick(id);
      if (error || !data) throw new Error(error || t("pages.trackingTools.clickMissing"));
      setClickLookup(data as unknown as Record<string, unknown>);
      toast.success(t("pages.trackingTools.clickFound"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("pages.trackingTools.lookupFail"));
    } finally {
      setClickLookupLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
      <p className="text-sm text-muted-foreground">{t("pages.trackingTools.clickIntro")}</p>
      <div className="flex flex-col sm:flex-row items-end gap-4">
        <div className="space-y-2 flex-1">
          <Label>{t("pages.trackingTools.clickId")}</Label>
          <Input
            placeholder="ex.: a1b2c3d4-…"
            value={clickIdInput}
            onChange={(e) => setClickIdInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookupClick()}
            className="font-mono text-xs"
          />
        </div>
        <Button
          type="button"
          onClick={handleLookupClick}
          disabled={clickLookupLoading}
          className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90"
        >
          {clickLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {clickLookupLoading ? t("pages.trackingTools.lookingUp") : t("pages.trackingTools.lookup")}
        </Button>
      </div>
      {clickLookup ? (
        <dl className="grid gap-2 sm:grid-cols-2 text-xs rounded-lg border border-border/50 bg-muted/20 p-4">
          {(
            [
              [t("pages.trackingTools.dest"), clickLookup.redirect_to ?? clickLookup.destination_url ?? clickLookup.to],
              ["IP", clickLookup.ip],
              [t("pages.trackingTools.country"), clickLookup.country],
              ["GCLID", clickLookup.gclid],
              [t("pages.trackingTools.campaign"), clickLookup.campaign ?? clickLookup.utm_campaign],
              [t("pages.trackingTools.source"), clickLookup.source ?? clickLookup.utm_source],
              ["Sub1", clickLookup.sub1],
              ["Sub2", clickLookup.sub2],
              ["Sub3", clickLookup.sub3],
              [t("pages.trackingTools.when"), clickLookup.created_at ?? clickLookup.timestamp],
            ] as const
          )
            .filter(([, v]) => v != null && String(v).trim() !== "")
            .map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground break-all">{String(value)}</dd>
              </div>
            ))}
        </dl>
      ) : null}
    </div>
  );
}

function ManualGoogleConversionForm({
  postbackToken,
  onSent,
}: {
  postbackToken: string;
  onSent: () => void;
}) {
  const { t } = useAppLocale();
  const queryClient = useQueryClient();
  const { data: presells = [], isLoading: loadingPresells } = useQuery({
    queryKey: ["presells"],
    queryFn: async () => {
      const { data, error } = await presellService.getAll();
      if (error) throw new Error(error);
      return data ?? [];
    },
  });

  const [presellId, setPresellId] = useState("");
  const [gclid, setGclid] = useState("");
  const [valueStr, setValueStr] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [transactionId, setTransactionId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (presells.length === 0) return;
    setPresellId((prev) => {
      if (prev) return prev;
      const pub = presells.find((p) => p.status === "published");
      return (pub ?? presells[0]).id;
    });
  }, [presells]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = gclid.trim();
    if (!presellId) {
      toast.error(t("pages.trackingTools.needPresell"));
      return;
    }
    if (!g) {
      toast.error(t("pages.trackingTools.needClickGclid"));
      return;
    }
    const value = Number.parseFloat(String(valueStr).replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast.error(t("pages.trackingTools.needValue"));
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await trackingService.postbackGoogleAds(
        {
          presell_id: presellId,
          gclid: g,
          value,
          currency: currency.toUpperCase().slice(0, 3),
          ...(transactionId.trim() ? { transaction_id: transactionId.trim() } : {}),
        },
        postbackToken,
      );
      if (error) throw new Error(error);
      toast.success(
        data && typeof data === "object" && "duplicate" in data && data.duplicate
          ? t("pages.trackingTools.duplicateConv")
          : t("pages.trackingTools.sent"),
      );
      setGclid("");
      void queryClient.invalidateQueries({ queryKey: ["presells"] });
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pages.trackingTools.sendFail"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Send className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-card-foreground">{t("pages.trackingTools.manualTitle")}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{t("pages.trackingTools.manualHint")}</p>
        </div>
      </div>

      <Alert className="border-sky-500/30 bg-sky-500/[0.06]">
        <AlertTitle className="text-sm">{t("pages.trackingTools.beforeSend")}</AlertTitle>
        <AlertDescription className="text-xs leading-relaxed space-y-2">
          <p>{t("pages.trackingTools.beforeSendP1")}</p>
          <p>
            {t("pages.trackingTools.beforeSendP2")}{" "}
            <Link to="/integracoes/google-ads" className="font-medium text-primary underline underline-offset-2">
              {t("pages.trackingTools.googleAdsLink")}
            </Link>
            .
          </p>
        </AlertDescription>
      </Alert>

      {loadingPresells ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("pages.trackingTools.loadingPresells")}
        </p>
      ) : presells.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("pages.trackingTools.createPresellFirst")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-google-presell">{t("pages.trackingTools.presellLabel")}</Label>
            <Select value={presellId} onValueChange={setPresellId}>
              <SelectTrigger id="manual-google-presell" className="w-full">
                <SelectValue placeholder={t("pages.trackingTools.choosePresell")} />
              </SelectTrigger>
              <SelectContent>
                {presells.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="truncate max-w-[min(100vw-4rem,28rem)]">
                      {p.title}
                      {p.status !== "published" ? ` (${p.status})` : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-google-gclid">GCLID</Label>
            <Input
              id="manual-google-gclid"
              placeholder={t("pages.trackingTools.gclidPlaceholder")}
              value={gclid}
              onChange={(e) => setGclid(e.target.value)}
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual-google-value">{t("pages.trackingTools.value")}</Label>
              <Input
                id="manual-google-value"
                type="text"
                inputMode="decimal"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-google-currency">{t("pages.trackingTools.currency")}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="manual-google-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "BRL", "GBP", "PLN", "CAD", "AUD"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-google-txid">{t("pages.trackingTools.txid")}</Label>
            <Input
              id="manual-google-txid"
              placeholder={t("pages.trackingTools.txidPlaceholder")}
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <Button
            type="submit"
            disabled={submitting || !presellId}
            className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90 w-full sm:w-auto"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? t("pages.trackingTools.sending") : t("pages.trackingTools.sendConversion")}
          </Button>
        </form>
      )}
    </div>
  );
}

function PostbacksPage() {
  const { t, locale } = useAppLocale();
  const numLocale = numberLocaleFor(locale);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [postbackTemplates, setPostbackTemplates] = useState<null | {
    token: string;
    endpoints: { google_ads: string; microsoft_ads: string };
  }>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [postbackAudit, setPostbackAudit] = useState<
    Array<{
      id: string;
      platform: string;
      status: string;
      message?: string | null;
      created_at: string;
      presell_id?: string | null;
    }>
  >([]);

  const reloadAudit = async () => {
    const audit = await trackingService.getPostbackAudit(15);
    if (audit.data) setPostbackAudit(audit.data);
  };

  useEffect(() => {
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      const { data } = await trackingService.getPostbackTemplates();
      if (data) setPostbackTemplates(data);
      const audit = await trackingService.getPostbackAudit(15);
      if (audit.data) setPostbackAudit(audit.data);
      setTemplatesLoading(false);
    };
    loadTemplates();
  }, []);

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border/50 space-y-6">
      {!templatesLoading && postbackTemplates ? (
        <ManualGoogleConversionForm postbackToken={postbackTemplates.token} onSent={reloadAudit} />
      ) : null}

      <h3 className="font-semibold text-card-foreground">{t("pages.trackingTools.postbackUrls")}</h3>
      {templatesLoading ? <p className="text-sm text-muted-foreground">{t("pages.trackingTools.loadingUrls")}</p> : null}
      {!templatesLoading && postbackTemplates ? (
        <>
          <div className="space-y-2">
            <Label>{t("pages.trackingTools.privateToken")}</Label>
            <div className="flex gap-2">
              <Input readOnly value={postbackTemplates.token} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={() => copyText("token", postbackTemplates.token)}>
                {copiedField === "token" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("pages.trackingTools.googlePostback")}</Label>
            <div className="flex gap-2">
              <Input readOnly value={postbackTemplates.endpoints.google_ads} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() => copyText("google", postbackTemplates.endpoints.google_ads)}
              >
                {copiedField === "google" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("pages.trackingTools.msPostback")}</Label>
            <div className="flex gap-2">
              <Input readOnly value={postbackTemplates.endpoints.microsoft_ads} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                onClick={() => copyText("microsoft", postbackTemplates.endpoints.microsoft_ads)}
              >
                {copiedField === "microsoft" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <Label>{t("pages.trackingTools.recentAudit")}</Label>
            <div className="max-h-64 overflow-auto rounded-md border border-border">
              {postbackAudit.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">{t("pages.trackingTools.noEvents")}</p>
              ) : (
                postbackAudit.map((row) => (
                  <div key={row.id} className="p-3 border-b border-border/50 last:border-0 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{row.platform}</span>
                      <span
                        className={
                          row.status === "success"
                            ? "text-green-600"
                            : row.status === "duplicate"
                              ? "text-amber-600"
                              : "text-red-600"
                        }
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{new Date(row.created_at).toLocaleString(numLocale)}</p>
                    {row.message ? <p>{row.message}</p> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function TrackingTools() {
  const { t } = useAppLocale();
  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title={t("pages.trackingTools.title")}
        description={t("pages.trackingTools.subtitle")}
      />
      <ToolsSubNav />
      <Routes>
        <Route index element={<Navigate to="ip" replace />} />
        <Route path="ip" element={<IpLookupPage />} />
        <Route path="gclid" element={<GclidDecoderPage />} />
        <Route path="clique" element={<ClickUuidPage />} />
        <Route path="postbacks" element={<PostbacksPage />} />
        <Route path="*" element={<Navigate to="ip" replace />} />
      </Routes>
    </div>
  );
}
