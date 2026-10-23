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
 * Copy voltada a afiliados — sem jargão de infra (Railway, SLO, paths internos).
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
          <p className="font-medium text-foreground">Ligação de rastreamento</p>
          <p className="text-xs text-muted-foreground">
            Os cliques dos anúncios passam por aqui antes de abrir o link da oferta.
          </p>
          <p className="text-[11px] text-muted-foreground">
            {isLoading
              ? "A verificar…"
              : ok
                ? `A funcionar · resposta ${data?.ms} ms${sameOrigin ? " · no seu domínio" : ""}`
                : "A ligação falhou — tente outra vez ou contacte o suporte."}
          </p>
          {ok && data?.track ? (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Tempo do redirect: típico {data.track.p50_ms ?? "—"} ms · quase todos{" "}
              {p95 ?? "—"} ms
              {!data.track.samples
                ? " · ainda sem cliques medidos neste período"
                : ""}
              {p95 != null && !sloOk
                ? " · mais lento do que o desejado"
                : p95 != null
                  ? " · dentro do alvo"
                  : ""}
            </p>
          ) : ok ? (
            <p className="text-[11px] text-muted-foreground">
              Serviço OK. Os tempos de redirect aparecem após o primeiro clique real.
            </p>
          ) : null}
          {ok && (data?.errors5m ?? 0) > 0 ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Houve {data?.errors5m} falha(s) recentes no rastreamento — se os anúncios estiverem activos,
              contacte o suporte.
            </p>
          ) : null}
          <p className="text-[10px] text-muted-foreground">
            Alvo: redirect rápido (abaixo de cerca de {slo} ms). Medição no servidor actual.
          </p>
        </div>
      </div>
    </div>
  );
}
