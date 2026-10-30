import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";
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
} from "@/pages/TrackingDashboard";

/**
 * Meta CAPI + TikTok Events API — envio servidor→rede das conversões aprovadas.
 * (A UI vivia no TrackingDashboard legado, que ficou sem rota após o redesign.)
 */
export default function AdPixelsConnectPage() {
  const { user } = useAuth();
  const locked = !userCanWriteIntegrations(user);
  const qc = useQueryClient();

  const [metaEnabled, setMetaEnabled] = useState(false);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaToken, setMetaToken] = useState("");
  const [metaTestCode, setMetaTestCode] = useState("");

  const [ttEnabled, setTtEnabled] = useState(false);
  const [ttPixelId, setTtPixelId] = useState("");
  const [ttToken, setTtToken] = useState("");
  const [ttTestCode, setTtTestCode] = useState("");

  const { data: metaCapi, isLoading: loadingMeta } = useQuery({
    queryKey: ["integrations", "meta-capi"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getMetaCapiSettings();
      if (error) throw new Error(error);
      return data!;
    },
  });

  const { data: tiktokEvents, isLoading: loadingTt } = useQuery({
    queryKey: ["integrations", "tiktok-events"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getTiktokEventsSettings();
      if (error) throw new Error(error);
      return data!;
    },
  });

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
        meta_capi_enabled: metaEnabled,
        meta_pixel_id: metaPixelId,
        meta_capi_test_event_code: metaTestCode,
      };
      if (metaToken.trim()) body.meta_access_token = metaToken.trim();
      const { data, error } = await integrationsService.patchMetaCapiSettings(body);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (d) => {
      toast.success(d.can_send ? "Meta CAPI pronta a enviar." : "Definições Meta guardadas.");
      setMetaToken("");
      void qc.invalidateQueries({ queryKey: ["integrations", "meta-capi"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao guardar Meta CAPI"),
  });

  const saveTiktokEvents = useMutation({
    mutationFn: async () => {
      const body: Parameters<typeof integrationsService.patchTiktokEventsSettings>[0] = {
        tiktok_events_enabled: ttEnabled,
        tiktok_pixel_id: ttPixelId,
        tiktok_events_test_event_code: ttTestCode,
      };
      if (ttToken.trim()) body.tiktok_events_access_token = ttToken.trim();
      const { data, error } = await integrationsService.patchTiktokEventsSettings(body);
      if (error) throw new Error(error);
      return data!;
    },
    onSuccess: (d) => {
      toast.success(d.can_send ? "TikTok Events pronto a enviar." : "Definições TikTok guardadas.");
      setTtToken("");
      void qc.invalidateQueries({ queryKey: ["integrations", "tiktok-events"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao guardar TikTok Events"),
  });

  if (loadingMeta || loadingTt) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message="A carregar pixels / CAPI…" />
      </div>
    );
  }

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Pixels e CAPI"
        subtitle="Envio servidor→rede das vendas aprovadas (Meta Conversions API e TikTok Events API). O pixel no browser da presell continua separado."
        meta={
          <>
            <ProStatusDot ok={Boolean(metaCapi?.can_send)} label="Meta CAPI" />
            <ProStatusDot ok={Boolean(tiktokEvents?.can_send)} label="TikTok Events" />
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/integracoes">Voltar</Link>
          </Button>
        }
      />

      <ProAlert
        severity="info"
        title="Dois níveis de «inteligência»"
        detail="(1) Pixel no browser da presell — PageView / Lead. (2) Este ecrã — Purchase servidor a servidor após postback, com fbclid/ttclid/gclid do clique. Sem o ID de clique no URL do anúncio, a rede não atribui."
      />

      <div className="space-y-5 max-w-3xl">
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
        />

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
        />
      </div>
    </div>
  );
}
