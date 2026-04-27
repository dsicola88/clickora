import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  paidAdsService,
  type CampaignRow,
  type ChangeRequestRow,
  type OauthConfigDto,
  type PaidOverviewDto,
} from "@/services/paidAdsService";

type MetaCount = { campaigns: number; drafts: number; pending: number; creatives: number };
type TikCount = { campaigns: number; drafts: number; pending: number };

export type DpilotPaidValue = {
  projectId: string;
  loading: boolean;
  err: string | null;
  overview: PaidOverviewDto | null;
  oauthConfig: OauthConfigDto | null;
  campaigns: CampaignRow[];
  changeRequests: ChangeRequestRow[];
  metaConn: { status?: string; account_name?: string | null; error_message?: string | null } | null;
  tikConn: { status?: string; account_name?: string | null; error_message?: string | null } | null;
  metaCounts: MetaCount | null;
  tiktokCounts: TikCount | null;
  loadingExtras: boolean;
  reload: () => void;
  connecting: "google" | "meta" | "tiktok" | null;
  startOAuth: (k: "google" | "meta" | "tiktok") => void;
  disconnect: (k: "google" | "meta" | "tiktok") => void;
  review: (id: string, status: "approved" | "rejected" | "applied") => void;
  isConnConnected: (c: { status?: string } | null | undefined) => boolean;
};

const Ctx = createContext<DpilotPaidValue | null>(null);

export function DpilotPaidProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [overview, setOverview] = useState<PaidOverviewDto | null>(null);
  const [oauthConfig, setOauthConfig] = useState<OauthConfigDto | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequestRow[]>([]);
  const [metaConn, setMetaConn] = useState<DpilotPaidValue["metaConn"]>(null);
  const [tikConn, setTikConn] = useState<DpilotPaidValue["tikConn"]>(null);
  const [metaCounts, setMetaCounts] = useState<MetaCount | null>(null);
  const [tiktokCounts, setTiktokCounts] = useState<TikCount | null>(null);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [connecting, setConnecting] = useState<"google" | "meta" | "tiktok" | null>(null);

  const isConnConnected = (c: { status?: string } | null | undefined) => c?.status === "connected";

  const loadCore = useCallback(async (pid: string) => {
    const [ov, cfg, camps, crs, mConn, tConn, mOv, tOv] = await Promise.all([
      paidAdsService.getOverview(pid),
      paidAdsService.getOauthConfig(),
      paidAdsService.listCampaigns(pid),
      paidAdsService.listChangeRequests(pid),
      paidAdsService.getMetaConnection(pid),
      paidAdsService.getTikTokConnection(pid),
      paidAdsService.getMetaOverview(pid),
      paidAdsService.getTikTokOverview(pid),
    ]);
    if (ov.error || !ov.data) {
      setErr(ov.error || "Resumo indisponível.");
      setOverview(null);
    } else {
      setErr(null);
      setOverview(ov.data);
    }
    if (cfg.data) setOauthConfig(cfg.data);
    if (camps.data?.campaigns) setCampaigns(camps.data.campaigns as CampaignRow[]);
    if (crs.data?.change_requests) setChangeRequests(crs.data.change_requests as ChangeRequestRow[]);
    setMetaConn(
      mConn.data != null
        ? (mConn.data as { status?: string; account_name?: string | null; error_message?: string | null })
        : null,
    );
    setTikConn(
      tConn.data != null
        ? (tConn.data as { status?: string; account_name?: string | null; error_message?: string | null })
        : null,
    );
    if (mOv.data) setMetaCounts(mOv.data);
    else setMetaCounts(null);
    if (tOv.data) setTiktokCounts(tOv.data);
    else setTiktokCounts(null);
  }, []);

  const reload = useCallback(() => {
    void loadCore(projectId);
  }, [projectId, loadCore]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      setLoadingExtras(true);
      try {
        await loadCore(projectId);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingExtras(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadCore]);

  useEffect(() => {
    if (loading) return;
    const g = searchParams.get("google");
    const m = searchParams.get("meta");
    const t = searchParams.get("tiktok");
    if (g === "connected") toast.success("Google Ads ligado com sucesso.");
    if (g === "error") toast.error("Não foi possível concluir o Google Ads OAuth.");
    if (m === "connected") toast.success("Meta Ads ligado com sucesso.");
    if (m === "error") toast.error("Não foi possível concluir o Meta OAuth.");
    if (t === "connected") toast.success("TikTok Ads ligado com sucesso.");
    if (t === "error") toast.error("Não foi possível concluir o TikTok OAuth.");
    if (g || m || t) {
      const next = new URLSearchParams(searchParams);
      next.delete("google");
      next.delete("meta");
      next.delete("tiktok");
      setSearchParams(next, { replace: true });
      void loadCore(projectId);
    }
  }, [loading, searchParams, setSearchParams, loadCore, projectId]);

  const startOAuth = useCallback(
    async (kind: "google" | "meta" | "tiktok") => {
      setConnecting(kind);
      try {
        const fn =
          kind === "google"
            ? paidAdsService.googleOAuthStart
            : kind === "meta"
              ? paidAdsService.metaOAuthStart
              : paidAdsService.tiktokOAuthStart;
        const { data, error } = await fn(projectId);
        if (error || !data?.url) {
          toast.error(error || "Não foi possível iniciar OAuth.");
          return;
        }
        window.location.assign(data.url);
      } finally {
        setConnecting(null);
      }
    },
    [projectId],
  );

  const disconnect = useCallback(
    async (kind: "google" | "meta" | "tiktok") => {
      const fn =
        kind === "google"
          ? paidAdsService.disconnectGoogle
          : kind === "meta"
            ? paidAdsService.disconnectMeta
            : paidAdsService.disconnectTiktok;
      const { error } = await fn(projectId);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Ligação removida.");
      void loadCore(projectId);
    },
    [projectId, loadCore],
  );

  const review = useCallback(
    async (id: string, status: "approved" | "rejected" | "applied") => {
      const { error } = await paidAdsService.reviewChangeRequest({ id, status });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(status === "applied" ? "Pedido aplicado." : "Atualizado.");
      void loadCore(projectId);
    },
    [projectId, loadCore],
  );

  const value: DpilotPaidValue = useMemo(
    () => ({
      projectId,
      loading,
      err,
      overview,
      oauthConfig,
      campaigns,
      changeRequests,
      metaConn,
      tikConn,
      metaCounts,
      tiktokCounts,
      loadingExtras,
      reload,
      connecting,
      startOAuth,
      disconnect,
      review,
      isConnConnected,
    }),
    [
      projectId,
      loading,
      err,
      overview,
      oauthConfig,
      campaigns,
      changeRequests,
      metaConn,
      tikConn,
      metaCounts,
      tiktokCounts,
      loadingExtras,
      reload,
      connecting,
      startOAuth,
      disconnect,
      review,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDpilotPaid(): DpilotPaidValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDpilotPaid fora de DpilotPaidProvider");
  return v;
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
