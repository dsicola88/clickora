import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { getTrackApiBaseUrl, getResolvedPublicApiBaseUrl, resolveTrackApiBaseForPanelEmbed } from "@/config/publicApiUrl";
import { customDomainService } from "@/services/customDomainService";
import { useAuth } from "@/contexts/AuthContext";
import { tenantQueryKey } from "@/lib/tenantQueryKey";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

type HealthBody = {
  status?: string;
  request_id?: string;
  ops?: {
    track_redirect?: {
      samples?: number;
      p50_ms?: number | null;
      p95_ms?: number | null;
      slo_p95_ms?: number;
    };
    errors_5xx_window_5m?: number;
  };
};

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    template,
  );
}

/**
 * Estado do click path (enterprise): health no host de tracking da conta (go.) se existir,
 * senão API da app. Evita «verde» no painel enquanto go. está partido.
 */
export function TrackPathStatus({ className }: { className?: string }) {
  const { t } = useAppLocale();
  const { user } = useAuth();
  const tenantKey = tenantQueryKey(user);
  const appApi = getResolvedPublicApiBaseUrl();

  const { data: domains = [] } = useQuery({
    queryKey: ["custom-domain", tenantKey, "track-path"],
    queryFn: async () => {
      const { data, error } = await customDomainService.list();
      if (error) throw new Error(error);
      return data ?? [];
    },
    enabled: Boolean(tenantKey),
    staleTime: 60_000,
  });

  const trackBase = resolveTrackApiBaseForPanelEmbed(domains);
  const healthUrl = `${trackBase.replace(/\/+$/, "")}/health`;
  const usingAccountTrackHost = trackBase !== getTrackApiBaseUrl() && trackBase !== "/api";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["track-path-health", healthUrl],
    queryFn: async () => {
      const t0 = performance.now();
      const res = await fetch(healthUrl, { method: "GET", credentials: "omit" });
      const ms = Math.round(performance.now() - t0);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as HealthBody;
      return {
        ms,
        status: body.status || "ok",
        requestId: body.request_id,
        track: body.ops?.track_redirect,
        errors5m: body.ops?.errors_5xx_window_5m ?? 0,
      };
    },
    staleTime: 60_000,
    retry: 1,
  });

  const ok = !isError && data?.status === "ok";
  const sameOrigin = trackBase === "/api" || trackBase === appApi;
  const p95 = data?.track?.p95_ms ?? null;
  const slo = data?.track?.slo_p95_ms ?? 400;
  const sloOk = p95 == null || p95 <= slo;

  const statusLine = isLoading
    ? t("pages.trackPath.checking")
    : ok
      ? fill(t("pages.trackPath.working"), { ms: data?.ms ?? "—" }) +
        (sameOrigin
          ? t("pages.trackPath.onYourDomain")
          : usingAccountTrackHost
            ? t("pages.trackPath.goTrackingDomain")
            : "")
      : usingAccountTrackHost
        ? t("pages.trackPath.accountHostFailed")
        : t("pages.trackPath.linkFailed");

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        ok && sloOk ? "border-border/60 bg-card" : "border-amber-500/40 bg-amber-500/10",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {isLoading ? (
          <Activity className="h-4 w-4 mt-0.5 text-muted-foreground animate-pulse" />
        ) : ok && sloOk ? (
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">{t("pages.trackPath.title")}</p>
          <p className="text-xs text-muted-foreground">
            {t("pages.trackPath.blurb")}
            {usingAccountTrackHost ? t("pages.trackPath.checkingAccountHost") : ""}
          </p>
          <p className="text-[11px] text-muted-foreground">{statusLine}</p>
          {ok && data?.track ? (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {fill(t("pages.trackPath.redirectTiming"), {
                p50: data.track.p50_ms ?? "—",
                p95: p95 ?? "—",
              })}
              {!data.track.samples ? t("pages.trackPath.noSamplesYet") : ""}
              {p95 != null && !sloOk
                ? t("pages.trackPath.slowerThanTarget")
                : p95 != null
                  ? t("pages.trackPath.withinTarget")
                  : ""}
            </p>
          ) : ok ? (
            <p className="text-[11px] text-muted-foreground">{t("pages.trackPath.serviceOk")}</p>
          ) : null}
          {ok && (data?.errors5m ?? 0) > 0 ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              {fill(t("pages.trackPath.recentErrors"), { n: data?.errors5m ?? 0 })}
            </p>
          ) : null}
          <p className="text-[10px] text-muted-foreground">
            {fill(t("pages.trackPath.sloHint"), { slo })}
          </p>
        </div>
      </div>
    </div>
  );
}
