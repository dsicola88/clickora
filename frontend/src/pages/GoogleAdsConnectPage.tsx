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
        toast.success("Conta ligada. As vendas aprovadas passam a seguir para o Google.");
      } else if (boot === "partial") {
        toast.message(params.get("boot_detail") || "Google autorizado. Escolha a conta abaixo.");
      } else if (boot === "error") {
        toast.error(
          params.get("boot_detail") ||
            "Google autorizado, mas a preparação falhou. Use «Actualizar ligação» ou indique o número da conta.",
        );
      } else {
        toast.message("Google autorizado. A confirmar a conta…");
      }
      void qc.invalidateQueries({ queryKey: ["integrations", "google-ads"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } else if (st === "error") {
      const reason = params.get("reason") || "";
      toast.error(
        reason === "no_refresh_token"
          ? "O Google não devolveu a autorização permanente. Volte a escolher a conta e aceite o acesso."
          : reason || "Não foi possível ligar o Google Ads",
      );
    }
    setParams({}, { replace: true });
  }, [params, setParams, qc]);

  const connect = useMutation({
    mutationFn: async () => {
      const { data: d, error } = await integrationsService.beginGoogleAdsOAuth();
      if (error || !d?.authorize_url) throw new Error(error || "Não foi possível abrir a página do Google.");
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
      if (!d?.ok) throw new Error(d?.detail || d?.error || "A ligação ficou incompleta");
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
      toast.success("Conta guardada.");
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
  const linked = Boolean(data?.has_refresh_token && data.google_ads_customer_id);
  const costsReady = linked;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Google Ads"
        subtitle="Ligue a conta. As vendas aprovadas seguem para o Google e o custo pode aparecer em Resultados."
        meta={
          <>
            <ProStatusDot ok={Boolean(data?.api_env_configured)} label="Serviço" />
            <ProStatusDot ok={Boolean(data?.has_refresh_token)} label="Conta Google" />
            <ProStatusDot ok={costsReady} label="Custos" />
            <ProStatusDot ok={ready} label="Vendas" />
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
          title="Ligação ao Google indisponível"
          detail="Esta conta ainda não consegue falar com o Google Ads. Contacte o suporte."
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <ProPanel
          title="Ligar a conta"
          description="Autoriza a dclickora a ler o custo dos anúncios e a enviar as vendas aprovadas. Não precisa de criar nada à mão no Google Ads."
        >
          <div className="space-y-4 px-4 py-4">
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal pl-4">
              <li>Clique em «Ligar Google Ads», escolha a conta onde estão os anúncios e aceite o acesso.</li>
              <li>A dclickora guarda essa conta e passa a enviar as vendas aprovadas.</li>
              <li>
                O custo, quando o Google o deixar ler, aparece em{" "}
                <ProInlineLink to="/resultados">Resultados</ProInlineLink>.
              </li>
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button disabled={locked || connect.isPending || linked} onClick={() => connect.mutate()} className="gap-2">
                {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {linked ? "Conta ligada" : "Ligar Google Ads"}
              </Button>
              {linked ? (
                <Button
                  variant="outline"
                  disabled={locked || connect.isPending}
                  onClick={() => connect.mutate()}
                  className="gap-2"
                >
                  Trocar conta
                </Button>
              ) : null}
              {data?.has_refresh_token ? (
                <Button
                  variant="secondary"
                  disabled={locked || bootstrap.isPending}
                  onClick={() => bootstrap.mutate()}
                  className="gap-2"
                >
                  {bootstrap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Actualizar ligação
                </Button>
              ) : null}
            </div>

            {ready ? (
              <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-foreground">Vendas prontas a enviar</p>
                  <p className="text-muted-foreground mt-0.5">
                    {`Conta ${data?.google_ads_customer_id}. ${
                      data?.google_ads_login_customer_id
                        ? `Conta gestora ${data.google_ads_login_customer_id}.`
                        : "Conta gestora não indicada."
                    } O custo em Resultados só aparece se o Google aceitar a leitura desta conta.`}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </ProPanel>

        <ProPanel title="Estado" description="O que já está automático nesta conta.">
          <ul className="divide-y divide-border/50 text-sm">
            {[
              ["Conta Google", data?.has_refresh_token ? "Ligada" : "Por ligar"],
              ["Número da conta", data?.google_ads_customer_id || "—"],
              ["Conta gestora", data?.google_ads_login_customer_id || "Não indicada"],
              ["Envio das vendas", data?.google_ads_enabled ? "Activo" : "Desligado"],
              ["Pronto a enviar", data?.can_upload ? "Sim" : "Ainda não"],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="text-xs font-mono font-medium text-right">{v}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border/60 px-4 py-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/integracoes/automizer">Actualizar custos</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/resultados">
                Resultados <ExternalLink className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </ProPanel>
      </div>

      {data?.has_refresh_token && (!data.google_ads_customer_id || !data.google_ads_login_customer_id) ? (
        <ProPanel
          title="Indicar a conta à mão"
          description={
            data.google_ads_customer_id
              ? "A conta de anúncios já está guardada. Se o Google recusar o custo, indique o número da conta que gere as outras."
              : "Cole os 10 dígitos da conta onde estão os anúncios. Se essa conta for gerida por outra, indique também o número da conta gestora."
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 px-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Número da conta</Label>
              <Input
                className="h-9 font-mono text-xs"
                value={customerDraft}
                disabled={locked}
                onChange={(e) => setCustomerDraft(e.target.value)}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Conta gestora (opcional)</Label>
              <Input
                className="h-9 font-mono text-xs"
                value={mccDraft}
                disabled={locked}
                onChange={(e) => setMccDraft(e.target.value)}
                placeholder="Só se tiver uma conta que gere as outras"
              />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" disabled={locked || saveIds.isPending} onClick={() => saveIds.mutate()}>
                Guardar
              </Button>
            </div>
          </div>
        </ProPanel>
      ) : null}
    </div>
  );
}
