import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { getTrackApiBaseUrl, getResolvedPublicApiBaseUrl } from "@/config/publicApiUrl";
import { cn } from "@/lib/utils";

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

/**
 * Estado do click path (enterprise): health + p95 amostrado no backend + ping do browser.
 */
export function TrackPathStatus({ className }: { className?: string }) {
  const trackBase = getTrackApiBaseUrl();
  const appApi = getResolvedPublicApiBaseUrl();
  const healthUrl = `${trackBase.replace(/\/+$/, "")}/health`;

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
          <p className="font-medium text-foreground">Click path (tracking)</p>
          <p className="text-xs text-muted-foreground font-mono break-all">{trackBase}/track/r/…</p>
          <p className="text-[11px] text-muted-foreground">
            {isLoading
              ? "A medir latência…"
              : ok
                ? `Health OK · ping ${data?.ms} ms${sameOrigin ? " · same-origin" : " · API directa"}`
                : "Health falhou — confirme Railway always-on e KEEP_ALIVE_URL."}
          </p>
          {ok && data?.track ? (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Redirect amostrado: p50 {data.track.p50_ms ?? "—"} ms · p95 {p95 ?? "—"} ms
              {data.track.samples
                ? ` · n=${data.track.samples}`
                : " · sem amostras — gera-se no 1.º clique real em /track/r/"}
              {p95 != null && !sloOk ? ` · acima do SLO ${slo} ms` : p95 != null ? " · dentro do SLO" : ""}
            </p>
          ) : ok ? (
            <p className="text-[11px] text-muted-foreground">
              Health OK. Amostras p50/p95 aparecem após redirects neste processo (deploy Fase 2).
            </p>
          ) : null}
          {ok && (data?.errors5m ?? 0) > 0 ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              {data?.errors5m} erro(s) 5xx nos últimos 5 min (processo actual).
            </p>
          ) : null}
          <p className="text-[10px] text-muted-foreground">
            SLO alvo: p95 redirect &lt; {slo} ms (EU). Same-origin /api via Vercel é o path correcto;
            amostras são por réplica Railway (reinício = zero).
          </p>
        </div>
      </div>
    </div>
  );
}
