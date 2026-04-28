import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /** Recarrega dados sem desmontar o layout (botão «Tentar novamente», etc.). */
  reload: () => void;
  connecting: "google" | "meta" | "tiktok" | null;
  disconnecting: "google" | "meta" | "tiktok" | null;
  /** Impede duplo envio nos botões de aprovação do mesmo pedido. */
  reviewBusyChangeRequestId: string | null;
  startOAuth: (k: "google" | "meta" | "tiktok") => void;
  disconnect: (k: "google" | "meta" | "tiktok") => void;
  review: (id: string, status: "approved" | "rejected" | "applied") => Promise<void>;
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
  const [disconnecting, setDisconnecting] = useState<"google" | "meta" | "tiktok" | null>(null);
  const [reviewBusyChangeRequestId, setReviewBusyChangeRequestId] = useState<string | null>(null);
  const disconnectLockRef = useRef(false);
  const reviewLockRef = useRef(false);

  const isConnConnected = (c: { status?: string } | null | undefined) => c?.status === "connected";

  function isValidOverview(d: unknown): d is PaidOverviewDto {
    if (!d || typeof d !== "object") return false;
    const o = d as Record<string, unknown>;
    const p = o["project"];
    if (!p || typeof p !== "object" || typeof (p as { paid_mode?: unknown }).paid_mode !== "string")
      return false;
    if (typeof o["pending_approvals"] !== "number") return false;
    return true;
  }

  const loadCore = useCallback(async (pid: string) => {
    type ApiOk<T> = { data: T | null; error: string | null };
    const settled = await Promise.allSettled([
      paidAdsService.getOverview(pid),
      paidAdsService.getOauthConfig(),
      paidAdsService.listCampaigns(pid),
      paidAdsService.listChangeRequests(pid),
      paidAdsService.getMetaConnection(pid),
      paidAdsService.getTikTokConnection(pid),
      paidAdsService.getMetaOverview(pid),
      paidAdsService.getTikTokOverview(pid),
    ]);

    const unwrap = <T,>(index: number): ApiOk<T> => {
      const r = settled[index];
      if (!r || r.status === "rejected") {
        return {
          data: null,
          error: r?.status === "rejected" && r.reason instanceof Error ? r.reason.message : "Pedido interrompido.",
        };
      }
      return r.value as ApiOk<T>;
    };

    const ov = unwrap<PaidOverviewDto>(0);
    const cfg = unwrap<OauthConfigDto>(1);
    const camps = unwrap<{ campaigns: CampaignRow[] }>(2);
    const crs = unwrap<{ change_requests: ChangeRequestRow[] }>(3);
    const mConn = unwrap<unknown>(4);
    const tConn = unwrap<unknown>(5);
    const mOv = unwrap<MetaCount>(6);
    const tOv = unwrap<TikCount>(7);

    if (ov.error || !ov.data) {
      setErr(ov.error || "Resumo indisponível.");
      setOverview(null);
    } else if (!isValidOverview(ov.data)) {
      setErr("Resumo do projecto incompleto. Tente recarregar a página.");
      setOverview(null);
    } else {
      setErr(null);
      setOverview(ov.data);
    }

    if (cfg.data) setOauthConfig(cfg.data);

    if (camps.data?.campaigns) setCampaigns(camps.data.campaigns as CampaignRow[]);
    else if (camps.error) setCampaigns([]);

    if (crs.data?.change_requests) setChangeRequests(crs.data.change_requests as ChangeRequestRow[]);
    else if (crs.error) setChangeRequests([]);

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
    void (async () => {
      setLoadingExtras(true);
      try {
        await loadCore(projectId);
      } finally {
        setLoadingExtras(false);
      }
    })();
  }, [projectId, loadCore]);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setOverview(null);
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
      if (disconnectLockRef.current) return;
      disconnectLockRef.current = true;
      setDisconnecting(kind);
      try {
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
        await loadCore(projectId);
      } finally {
        disconnectLockRef.current = false;
        setDisconnecting(null);
      }
    },
    [projectId, loadCore],
  );

  const review = useCallback(
    async (id: string, status: "approved" | "rejected" | "applied") => {
      if (reviewLockRef.current) return;
      reviewLockRef.current = true;
      setReviewBusyChangeRequestId(id);
      try {
        const { error } = await paidAdsService.reviewChangeRequest({ id, status });
        if (error) {
          toast.error(error);
          return;
        }
        if (status === "applied") {
          toast.success("Aplicado na rede", {
            description: "O pedido foi enviado para a conta publicitária (Google Ads, Meta ou TikTok).",
          });
        } else if (status === "approved") {
          toast.success("Pedido aprovado", {
            description:
              "A decisão ficou registada. Para publicar de facto na rede, utilize «Aplicar na rede» no mesmo pedido.",
          });
        } else {
          toast.info("Pedido rejeitado", {
            description: "Este pedido não será aplicado na conta publicitária.",
          });
        }
        await loadCore(projectId);
      } finally {
        reviewLockRef.current = false;
        setReviewBusyChangeRequestId(null);
      }
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
      disconnecting,
      reviewBusyChangeRequestId,
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
      disconnecting,
      reviewBusyChangeRequestId,
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
