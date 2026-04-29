import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Info, Loader2, Plug, Plus, Unplug, Video } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { createTikTokDraftCampaign, getTikTokConnection } from "@/server/app-data.functions";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TikTokConnectionRow } from "@/types/domain";
import {
  checkTikTokOAuthAvailable,
  disconnectTikTokConnection,
} from "@/server/tiktok-oauth.functions";

type TikTokConn = TikTokConnectionRow;

export const Route = createFileRoute("/app/projects/$projectId/paid/tiktok")({
  component: TikTokLayout,
});

function TikTokLayout() {
  const { projectId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const subNav: Array<{ to: string; label: string; end?: boolean }> = [
    { to: "/app/projects/$projectId/paid/tiktok", label: "Visão geral", end: true },
    { to: "/app/projects/$projectId/paid/tiktok/campaigns", label: "Campanhas" },
  ];

  return (
    <div>
      <div className="border-b border-border bg-card/30">
        <div className="flex flex-wrap items-center gap-2 px-6 pt-4 sm:px-8">
          <Video className="h-4 w-4 text-pink-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            TikTok Ads
          </span>
          <Badge variant="muted" className="ml-1">
            Beta
          </Badge>
        </div>
        <nav className="flex gap-1 px-4 pt-3 sm:px-6">
          {subNav.map((s) => {
            const fullPath = s.to.replace("$projectId", projectId);
            const active = s.end ? pathname === fullPath : pathname.startsWith(fullPath);
            return (
              <Link
                key={s.to}
                to={s.to}
                params={{ projectId }}
                className={cn(
                  "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

export function TikTokConnectionCard({ projectId }: { projectId: string }) {
  const [conn, setConn] = useState<TikTokConn | null | undefined>(undefined);
  const [oauthAvail, setOauthAvail] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const checkAvail = useServerFn(checkTikTokOAuthAvailable);
  const disconnect = useServerFn(disconnectTikTokConnection);
  const fetchConn = useServerFn(getTikTokConnection);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function loadConn() {
    const data = await fetchConn({ data: { projectId } });
    setConn(data ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadConn();
      if (cancelled) return;
      try {
        const r = await checkAvail();
        if (!cancelled) setOauthAvail(r.available);
      } catch {
        if (!cancelled) setOauthAvail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tiktok");
    if (t === "connected") {
      toast.success("TikTok Ads conectado com sucesso");
      void loadConn();
    } else if (t === "error") {
      toast.error("Falha ao conectar TikTok Ads. Veja o status abaixo.");
      void loadConn();
    }
    if (t) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tiktok");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function handleConnect() {
    setBusy(true);
    try {
      window.location.href = `/hooks/tiktok-oauth/start?projectId=${encodeURIComponent(projectId)}`;
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar TikTok Ads deste projeto?")) return;
    setBusy(true);
    try {
      await disconnect({ data: { projectId } });
      toast.success("TikTok Ads desconectado");
      await loadConn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao desconectar");
    } finally {
      setBusy(false);
    }
  }

  if (conn === undefined) {
    return <Skeleton className="h-44 w-full rounded-2xl" />;
  }

  const status = conn?.status ?? "disconnected";
  const isConnected = status === "connected";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/15 text-pink-600 ring-1 ring-inset ring-pink-500/30 dark:text-pink-400">
            <Plug className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">TikTok Ads</p>
            <p className="font-semibold">{conn?.account_name ?? "Não conectado"}</p>
          </div>
        </div>
        <Badge variant={isConnected ? "success" : status === "error" ? "destructive" : "muted"}>
          {isConnected ? "Conectado" : status === "error" ? "Erro" : "Desconectado"}
        </Badge>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {conn?.advertiser_id
          ? `Advertiser ID ${conn.advertiser_id}`
          : "Ligue TikTok for Business para criar rascunhos na API."}
      </p>
      {conn?.error_message && (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {conn.error_message}
        </p>
      )}
      {conn?.last_sync_at && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Última autorização: {new Date(conn.last_sync_at).toLocaleString("pt-BR")}
        </p>
      )}

      {isConnected ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={handleDisconnect}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Unplug className="mr-1 h-4 w-4" />
          )}
          Desconectar
        </Button>
      ) : (
        <Button
          size="sm"
          className="mt-4 w-full"
          onClick={handleConnect}
          disabled={busy || oauthAvail === false}
          title={
            oauthAvail === false
              ? "Configure TIKTOK_APP_ID e TIKTOK_APP_SECRET no ambiente."
              : undefined
          }
        >
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {oauthAvail === false ? "Conectar TikTok (config necessária)" : "Conectar TikTok Ads"}
        </Button>
      )}

      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Info className="h-3 w-3" />
        Requer app no{" "}
        <a
          className="underline underline-offset-2 hover:text-foreground"
          href="https://business-api.tiktok.com/portal/"
          target="_blank"
          rel="noreferrer"
        >
          TikTok for Business
        </a>{" "}
        · <code className="rounded bg-muted px-1">TIKTOK_APP_ID</code> +{" "}
        <code className="rounded bg-muted px-1">TIKTOK_APP_SECRET</code>
      </p>
    </div>
  );
}

export function NewTikTokCampaignButton({ projectId }: { projectId: string }) {
  const createDraft = useServerFn(createTikTokDraftCampaign);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await createDraft({ data: { projectId } });
      toast.success("Rascunho criado — veja em Campanhas e na fila de aprovações.");
      await navigate({
        to: "/app/projects/$projectId/paid/tiktok/campaigns",
        params: { projectId },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar rascunho");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={() => void onClick()} disabled={busy}>
      <Plus className="mr-1 h-4 w-4" /> Nova campanha (rascunho)
    </Button>
  );
}
