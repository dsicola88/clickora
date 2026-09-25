import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Megaphone, Plug, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
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

/**
 * Hub Integrações — go-live operativo para media buyers.
 */
export default function IntegrationsHubPage() {
  const { user, isSuperAdmin } = useAuth();
  const dpilot = userCanAccessDpilotAds(user, isSuperAdmin);
  const range = useMemo(() => rangeLast14Days(), []);

  const { data: dash } = useQuery({
    queryKey: ["dashboard", "integrations-health", range.from, range.to],
    queryFn: async () => {
      const { data, error } = await analyticsService.getDashboard({ from: range.from, to: range.to });
      if (error) return null;
      return data;
    },
    staleTime: 60_000,
  });

  const health = dash?.account_health;
  const steps = [
    {
      t: "Presell publicada",
      id: "presell_published",
      href: "/presells/nova",
      d: "Espelho da oferta + click ID no hoplink (subid / sub3 / cid).",
    },
    {
      t: "Postback",
      id: "postback_configured",
      href: "/integracoes/postback",
      d: "URL com macros na BuyGoods / SmartAdv / Digistore.",
    },
    {
      t: "Campanha + URL Ads",
      id: "campaign_linked",
      href: "/campanhas",
      d: "utm_campaign slug · utm_term={keyword} · utm_content={adgroupid}.",
    },
    {
      t: "Google Ads + sync",
      id: "google_ads",
      href: "/integracoes/automizer",
      d: "OAuth + sync de custos para ROAS do período.",
    },
  ] as const;

  return (
    <div className={PRO_PAGE_SHELL}>
      <ProPageHeader
        title="Integrações"
        subtitle="Pipeline afiliado: postback obrigatório · Google/Meta/TikTok opcional depois de bater atribuição."
        meta={
          health ? (
            <>
              <ProStatusDot ok={health.score >= 85} label={`Saúde ${health.score}%`} />
              <ProInlineLink to="/resultados">Ver no P&L</ProInlineLink>
            </>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <ProPanel title="Go-live" description="Estado real da conta (últimos 14 dias).">
          <ol className="divide-y divide-border/50">
            {steps.map((s, i) => {
              const check = health?.checks.find((c) => c.id === s.id);
              const ok = check?.ok;
              return (
                <li key={s.id} className="flex gap-3 px-4 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <ProStatusDot ok={ok !== false} label={s.t} />
                      {ok === false ? (
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

          <Link
            to="/integracoes/automizer"
            className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div className="rounded-md bg-primary/10 p-2">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                Automizer &amp; custos
                <Badge variant="secondary" className="text-[10px]">
                  Pro
                </Badge>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                Sync diário · pause keywords sem receita · auditoria.
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
                Offline / CAPI / Events — depois do postback estável.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </Link>

          {dpilot ? (
            <Link
              to="/dpilot"
              className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="rounded-md bg-primary/10 p-2">
                <Megaphone className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">dPilot Ads</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                  Copilot / Autopilot Google Search.
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
