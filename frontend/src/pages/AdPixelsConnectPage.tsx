import { useAppLocale } from "@/i18n/AppLocaleProvider";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { integrationsService } from "@/services/integrationsService";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProStatusDot,
  ProAlert,
} from "@/components/enterprise/ProShell";
import {
  MetaCapiIntegrationCard,
  TiktokEventsIntegrationCard,
} from "@/components/integrations/AdPixelIntegrationCards";

/**
 * Meta CAPI + TikTok Events API — envio servidor→rede das conversões aprovadas.
 */
export default function AdPixelsConnectPage() {
  const { t } = useAppLocale();
  const { user } = useAuth();
  const locked = !userCanWriteIntegrations(user);
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();

  const [metaEnabled, setMetaEnabled] = useState(false);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [metaTestCode, setMetaTestCode] = useState("");

  const [ttEnabled, setTtEnabled] = useState(false);
  const [ttPixelId, setTtPixelId] = useState("");
  const [ttToken, setTtToken] = useState("");
  const [ttTestCode, setTtTestCode] = useState("");

  const {
    data: metaCapi,
    isLoading: loadingMeta,
    isError: metaError,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ["integrations", "meta-capi"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getMetaCapiSettings();
      if (error) throw new Error(error);
      return data!;
    },
  });

  const {
    data: tiktokEvents,
    isLoading: loadingTt,
    isError: ttError,
    refetch: refetchTt,
  } = useQuery({
    queryKey: ["integrations", "tiktok-events"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getTiktokEventsSettings();
      if (error) throw new Error(error);
      return data!;
    },
  });

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus !== "meta" && focus !== "tiktok") return;
    const id = focus === "meta" ? "pixels-meta" : "pixels-tiktok";
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [searchParams, loadingMeta, loadingTt]);

  useEffect(() => {
    if (!metaCapi) return;
    setMetaEnabled(metaCapi.meta_capi_enabled);
    setMetaPixelId(metaCapi.meta_pixel_id);
    setMetaTestCode(metaCapi.meta_capi_test_event_code ?? "");
  }, [metaCapi]);

  useEffect(() => {
    if (!tiktokEvents) return;
    setTtEnabled(tiktokEvents.tiktok_events_enabled);
    setTtPixelId(tiktokEvents.tiktok_pixel_id);
    setTtTestCode(tiktokEvents.tiktok_events_test_event_code ?? "");
  }, [tiktokEvents]);

  const saveMetaCapi = useMutation({
    mutationFn: async () => {
      const body: Parameters<typeof integrationsService.patchMetaCapiSettings>[0] = {
        meta_capi_enabled: true,
        meta_pixel_id: metaPixelId,
        meta_capi_test_event_code: metaTestCode,
      };
      if (metaToken.trim()) body.meta_access_token = metaToken.trim();
      const { data, error } = await integrationsService.patchMetaCapiSettings(body);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (d) => {
      toast.success(d.can_send ? t("pages.pixels.metaReady") : t("pages.pixels.metaSaved"));
      setMetaToken("");
      void qc.invalidateQueries({ queryKey: ["integrations", "meta-capi"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message || t("pages.pixels.metaFail")),
  });

  const saveTiktokEvents = useMutation({
    mutationFn: async () => {
      const body: Parameters<typeof integrationsService.patchTiktokEventsSettings>[0] = {
        tiktok_events_enabled: true,
        tiktok_pixel_id: ttPixelId,
        tiktok_events_test_event_code: ttTestCode,
      };
      if (ttToken.trim()) body.tiktok_events_access_token = ttToken.trim();
      const { data, error } = await integrationsService.patchTiktokEventsSettings(body);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (d) => {
      toast.success(d.can_send ? t("pages.pixels.ttReady") : t("pages.pixels.ttSaved"));
      setTtToken("");
      void qc.invalidateQueries({ queryKey: ["integrations", "tiktok-events"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message || t("pages.pixels.ttFail")),
  });

  if (loadingMeta || loadingTt) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message={t("pages.pixels.loading")} />
      </div>
    );
  }

  if (metaError || ttError) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <ErrorState
          message={t("common.loadFailed")}
          onRetry={() => {
            void refetchMeta();
            void refetchTt();
          }}
        />
      </div>
    );
  }

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.pixels.title")}
        subtitle={t("pages.pixels.subtitle")}
        meta={
          <>
            <ProStatusDot ok={Boolean(metaCapi?.can_send)} label={t("pages.pixels.metaLabel")} />
            <ProStatusDot ok={Boolean(tiktokEvents?.can_send)} label={t("pages.pixels.ttLabel")} />
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/integracoes">{t("pages.pixels.back")}</Link>
          </Button>
        }
      />

      <ProAlert
        severity="info"
        title={t("pages.pixels.minTitle")}
        detail={t("pages.pixels.minDetail")}
      />

      <div className="space-y-5 max-w-3xl">
        <div id="pixels-meta">
          <MetaCapiIntegrationCard
            metaCapi={metaCapi}
            metaEnabled={metaEnabled}
            setMetaEnabled={setMetaEnabled}
            metaPixelId={metaPixelId}
            setMetaPixelId={setMetaPixelId}
            metaToken={metaToken}
            setMetaToken={setMetaToken}
            metaTestCode={metaTestCode}
            setMetaTestCode={setMetaTestCode}
            saveMetaCapi={saveMetaCapi}
            integrationsLocked={locked}
            autoMode
          />
        </div>

        <div id="pixels-tiktok">
          <TiktokEventsIntegrationCard
            tiktok={tiktokEvents}
            ttEnabled={ttEnabled}
            setTtEnabled={setTtEnabled}
            ttPixelId={ttPixelId}
            setTtPixelId={setTtPixelId}
            ttToken={ttToken}
            setTtToken={setTtToken}
            ttTestCode={ttTestCode}
            setTtTestCode={setTtTestCode}
            saveTiktok={saveTiktokEvents}
            integrationsLocked={locked}
            autoMode
          />
        </div>
      </div>
    </div>
  );
}
