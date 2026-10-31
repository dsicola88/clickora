import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plug, ShieldCheck, LineChart, Zap, Megaphone } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { playSaleChime, saleChimeEnabled, setSaleChimeEnabled } from "@/lib/saleChime";
import { useAuth } from "@/contexts/AuthContext";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { Badge } from "@/components/ui/badge";
import { analyticsService } from "@/services/analyticsService";
import { rangeLast14Days } from "@/lib/dateRangePresets";
import {
  PRO_PAGE_SHELL,
  ProPageHeader,
  ProPanel,
  ProStatusDot,
  ProInlineLink,
} from "@/components/enterprise/ProShell";
import { AttributionHealthBanner } from "@/components/AttributionHealthBanner";
import { TrackPathStatus } from "@/components/TrackPathStatus";
import { SyncHealthBanner } from "@/components/SyncHealthBanner";
import { PostbackMacroChecklist } from "@/components/PostbackMacroChecklist";
import { useAppLocale } from "@/i18n/AppLocaleProvider";

/**
 * Hub Integrações — go-live operativo para media buyers.
 */
export default function IntegrationsHubPage() {
  const { user, isSuperAdmin } = useAuth();
  const { t } = useAppLocale();
  const dpilot = userCanAccessDpilotAds(user, isSuperAdmin);
  const [saleChimeOn, setSaleChimeOn] = useState(() => saleChimeEnabled());
  const range = useMemo(() => rangeLast14Days(), []);

  const { data: dash, isError: dashError, refetch: refetchDash } = useQuery({
    queryKey: ["dashboard", "integrations-health", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({ from: range.from, to: range.to });
      if (error) throw new Error(error);
      return data;
    },
    staleTime: 60_000,
  });

  const postbackUrl =
    typeof dash?.tracking_install?.affiliate_webhook_path === "string"
      ? dash.tracking_install.affiliate_webhook_path
      : "";

  const health = dash?.account_health;
  const steps = [
    {
      t: "Presell publicada",
      id: "presell_published",
      href: "/presells/nova",
      d: "Página no ar com o link da oferta no botão.",
    },
    {
      t: "Aviso de venda",
      id: "postback_configured",
      href: "/integracoes/postback",
      d: "URL de aviso colado na BuyGoods / SmartAdv / Digistore.",
    },
    {
      t: "Campanha + URL do anúncio",
      id: "campaign_linked",
      href: "/campanhas",
      d: "URL gerada pela Clickora colada no Google Ads.",
    },
    {
      t: "Google Ads ligado",
      id: "google_ads",
      href: "/integracoes/google-ads",
      d: "Custos e vendas enviados automaticamente.",
    },
    {
      t: "Custos actualizados",
      id: "cost_sync",
      href: "/integracoes/automizer",
      d: "Última sincronização há menos de 48h — senão o lucro fica incompleto.",
    },
    {
      t: "Envios às redes de anúncios",
      id: "ads_upload",
      href: "/resultados/relatorios/conversoes",
      d: "Erros de envio ou vendas sem ID do clique nos últimos 7 dias.",
    },
    {
      t: "Domínio com cadeado HTTPS",
      id: "domain_https",
      href: "/configuracoes",
      d: "O link do anúncio deve abrir em HTTPS (DNS sozinho não chega).",
    },
  ] as const;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title={t("pages.integrations.title")}
        subtitle={t("pages.integrations.subtitle")}
        meta={
          health ? (
            <>
              <ProStatusDot ok={health.score >= 85} label={`Saúde ${health.score}%`} />
              <ProInlineLink to="/resultados">{t("pages.results.title")}</ProInlineLink>
            </>
          ) : null
        }
      />

      {health ? (
        <AttributionHealthBanner attribution={health.attribution} checks={health.checks} />
      ) : null}
      <SyncHealthBanner syncHealth={dash?.sync_health} />
      <TrackPathStatus />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <ProPanel title={t("pages.integrations.goLive")} description={t("pages.integrations.goLiveDesc")}>
          <ol className="divide-y divide-border/50">
            {steps.map((s, i) => {
              const check = health?.checks.find((c) => c.id === s.id);
              return (
                <li key={s.id} className="flex gap-3 px-4 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {check == null ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
                          {s.t}
                        </span>
                      ) : (
                        <ProStatusDot ok={check.ok} label={s.t} />
                      )}
                      {check?.ok === false ? (
                        <Link to={s.href} className="text-[11px] font-medium text-primary hover:underline">
                          Resolver
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      {check?.detail || s.d}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </ProPanel>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Som de venda</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  Ligado neste aparelho. O som escolhe-se em Plataformas → Som da venda; o push e a app usam o mesmo. E-mail e
                  cartão saem com o browser fechado.
                </p>
              </div>
              <Switch
                checked={saleChimeOn}
                onCheckedChange={(on) => {
                  setSaleChimeEnabled(on);
                  setSaleChimeOn(on);
                }}
                aria-label="Som de venda"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!saleChimeOn}
              onClick={() => {
                void playSaleChime().then((ok) => {
                  if (!ok) toast.error("O browser bloqueou o som. Clique outra vez em Ouvir agora.");
                });
              }}
            >
              Ouvir agora
            </Button>
          </div>
          <div className="space-y-3">
            <Link
              to="/integracoes/postback"
              className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="rounded-md bg-primary/10 p-2">
                <Plug className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Postback (obrigatório)</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  BuyGoods, SmartAdv, Digistore24 e outras redes.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
            <PostbackMacroChecklist compact postbackUrl={postbackUrl || undefined} />
            {dashError ? (
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Não foi possível carregar o health da conta.{" "}
                <button type="button" className="underline" onClick={() => void refetchDash()}>
                  Tentar novamente
                </button>
              </p>
            ) : null}
          </div>

          <Link
            to="/integracoes/google-ads"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <LineChart className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                Google Ads
                <Badge variant="secondary" className="text-[10px]">
                  1 clique
                </Badge>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                OAuth desta conta: sync de custos + upload GCLID (não cria campanhas).
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          <Link
            to="/integracoes/pixels"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                Pixels Meta e TikTok
                <Badge variant="secondary" className="text-[10px]">
                  Pixels
                </Badge>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                Envia a venda à Meta e ao TikTok depois do aviso da rede.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          <Link
            to="/integracoes/automizer"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                Automizer &amp; custos
                <Badge variant="secondary" className="text-[10px]">
                  Pro
                </Badge>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                Actualiza custos e pausa palavras-chave sem vendas.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          <Link
            to="/tracking/integrations-legacy"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Envio Google / Meta / TikTok</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                Envio avançado às redes — depois do aviso de venda estável.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          {dpilot ? (
            <Link
              to="/tracking/dpilot"
              className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="rounded-md bg-primary/10 p-2">
                <Megaphone className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">dPilot Ads</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  Criar/publicar campanhas Search — OAuth próprio em dPilot → Ligações (separado do sync de custos).
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
