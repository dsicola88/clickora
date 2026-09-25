import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/LoadingState";
import { useAuth } from "@/contexts/AuthContext";
import { userCanWriteIntegrations } from "@/lib/workspaceCapabilities";
import { integrationsService } from "@/services/integrationsService";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProPanel,
  ProStatusDot,
  ProAlert,
  ProInlineLink,
} from "@/components/enterprise/ProShell";

/**
 * Ligação Google Ads one-click: OAuth → conta + ação GCLID + upload + sync custos.
 */
export default function GoogleAdsConnectPage() {
  const { user } = useAuth();
  const locked = !userCanWriteIntegrations(user);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [customerDraft, setCustomerDraft] = useState("");
  const [mccDraft, setMccDraft] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["integrations", "google-ads"],
    queryFn: async () => {
      const { data, error } = await integrationsService.getGoogleAdsSettings();
      if (error) throw new Error(error);
      return data!;
    },
  });

  useEffect(() => {
    if (!data) return;
    setCustomerDraft(data.google_ads_customer_id || "");
    setMccDraft(data.google_ads_login_customer_id || "");
  }, [data]);

  useEffect(() => {
    const st = params.get("google_ads_oauth");
    if (!st) return;
    if (st === "success") {
      const boot = params.get("boot");
      if (boot === "ok") {
        toast.success("Google Ads ligado · custos e conversões automáticos.");
      } else if (boot === "partial") {
        toast.message(params.get("boot_detail") || "OAuth OK — complete a conta abaixo.");
      } else {
        toast.success("Google ligado. A sincronizar…");
      }
      void qc.invalidateQueries({ queryKey: ["integrations", "google-ads"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } else if (st === "error") {
      toast.error(params.get("reason") || "Falha no OAuth Google Ads");
    }
    setParams({}, { replace: true });
  }, [params, setParams, qc]);

  const connect = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await integrationsService.beginGoogleAdsOAuth();
      if (error || !d?.authorize_url) throw new Error(error || "Sem URL OAuth");
      return d.authorize_url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bootstrap = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await integrationsService.bootstrapGoogleAds();
      if (error) throw new Error(error);
      if (!d?.ok) throw new Error(d?.detail || d?.error || "Bootstrap incompleto");
      return d;
    },
    onSuccess: (d) => {
      toast.success(d.detail);
      void qc.invalidateQueries({ queryKey: ["integrations", "google-ads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveIds = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await integrationsService.patchGoogleAdsSettings({
        google_ads_customer_id: customerDraft,
        google_ads_login_customer_id: mccDraft,
        google_ads_enabled: true,
      });
      if (error) throw new Error(error);
      return d;
    },
    onSuccess: async () => {
      toast.success("Conta guardada — a preparar ação de conversão…");
      await bootstrap.mutateAsync();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className={PRO_PAGE_SHELL}>
        <LoadingState message="A carregar Google Ads…" />
      </div>
    );
  }

  const ready = Boolean(data?.can_upload && data.has_refresh_token);
  const costsReady = Boolean(data?.has_refresh_token && data.google_ads_customer_id);

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Google Ads"
        subtitle="Um clique: ligar conta → sync de custos no P&L → vendas aprovadas enviadas à Google automaticamente."
        meta={
          <>
            <ProStatusDot ok={Boolean(data?.api_env_configured)} label="API servidor" />
            <ProStatusDot ok={Boolean(data?.has_refresh_token)} label="OAuth" />
            <ProStatusDot ok={costsReady} label="Custos" />
            <ProStatusDot ok={ready} label="Upload conversões" />
            {isFetching ? <span>A actualizar…</span> : null}
          </>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/integracoes">Voltar</Link>
          </Button>
        }
      />

      {!data?.api_env_configured ? (
        <ProAlert
          severity="critical"
          title="Servidor sem credenciais Google Ads"
          detail="Peça ao administrador para definir GOOGLE_ADS_DEVELOPER_TOKEN, CLIENT_ID e CLIENT_SECRET."
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <ProPanel
          title="Ligar em 1 passo"
          description="Autoriza a Clickora a ler custos e a enviar conversões por GCLID. Sem criar ação manual no Google Ads."
        >
          <div className="space-y-4 px-4 py-4">
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal pl-4">
              <li>Clique em «Ligar Google Ads» e autorize com a conta do Ads.</li>
              <li>A app escolhe a conta, cria/reutiliza a ação offline e activa o envio.</li>
              <li>
                Já tem postback? Clique → compra → venda aprovada → Google recebe a conversão. Custos sincronizam no{" "}
                <ProInlineLink to="/resultados">P&L</ProInlineLink>.
              </li>
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button disabled={locked || connect.isPending} onClick={() => connect.mutate()} className="gap-2">
                {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Ligar Google Ads
              </Button>
              {data?.has_refresh_token ? (
                <Button
                  variant="secondary"
                  disabled={locked || bootstrap.isPending}
                  onClick={() => bootstrap.mutate()}
                  className="gap-2"
                >
                  {bootstrap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Re-sincronizar setup
                </Button>
              ) : null}
            </div>

            {ready ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-foreground">Pronto a operar</p>
                  <p className="text-muted-foreground mt-0.5">
                    Conta {data?.google_ads_customer_id} · ação {data?.google_ads_conversion_action_id} · upload ON.
                    Use o link da campanha com {"{gclid}"} e o postback da rede.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </ProPanel>

        <ProPanel title="Estado" description="O que já está automático nesta conta.">
          <ul className="divide-y divide-border/50 text-sm">
            {[
              ["OAuth", data?.has_refresh_token ? "Ligado" : "Pendente"],
              ["Customer ID", data?.google_ads_customer_id || "—"],
              ["Ação conversão", data?.google_ads_conversion_action_id || "—"],
              ["MCC / login", data?.google_ads_login_customer_id || "—"],
              ["Upload após venda", data?.google_ads_enabled ? "Activo" : "Off"],
              ["Pode enviar", data?.can_upload ? "Sim" : "Não"],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="text-xs font-mono font-medium text-right">{v}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border/60 px-4 py-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/integracoes/automizer">Automizer / sync custos</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/resultados">
                P&L <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </ProPanel>
      </div>

      {data?.has_refresh_token && !data.google_ads_customer_id ? (
        <ProPanel
          title="Escolher conta (só se o auto-detect falhar)"
          description="Cole o Customer ID de 10 dígitos. Se aceder via MCC, preencha também o Login customer ID."
        >
          <div className="grid gap-3 sm:grid-cols-2 px-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer ID</Label>
              <Input
                className="h-9 font-mono text-xs"
                value={customerDraft}
                disabled={locked}
                onChange={(e) => setCustomerDraft(e.target.value)}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Login MCC (opcional)</Label>
              <Input
                className="h-9 font-mono text-xs"
                value={mccDraft}
                disabled={locked}
                onChange={(e) => setMccDraft(e.target.value)}
                placeholder="Só se for gestora"
              />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" disabled={locked || saveIds.isPending} onClick={() => saveIds.mutate()}>
                Guardar e preparar conversões
              </Button>
            </div>
          </div>
        </ProPanel>
      ) : null}
    </div>
  );
}
