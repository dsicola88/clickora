import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Megaphone, Plug } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { userCanAccessDpilotAds } from "@/lib/dpilotAccess";
import { Badge } from "@/components/ui/badge";

/**
 * Hub Integrações — fluxo profissional em passos claros.
 */
export default function IntegrationsHubPage() {
  const { user, isSuperAdmin } = useAuth();
  const dpilot = userCanAccessDpilotAds(user, isSuperAdmin);

  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Integrações"
        description="Do anúncio à venda atribuída: postback da rede + (opcional) envio ao Google / Meta / TikTok."
      />

      <section className="rounded-xl border border-border/60 bg-card p-5 max-w-2xl mb-2">
        <h2 className="text-sm font-semibold text-foreground mb-3">Fluxo completo (4 passos)</h2>
        <ol className="space-y-3 text-sm text-muted-foreground">
          {[
            {
              t: "Presell publicada",
              d: "Crie a página com o hoplink da rede. A Clickora injeta o ID do clique (BuyGoods: subid · SmartAdv: sub3 · Digistore: cid).",
            },
            {
              t: "Postback na rede",
              d: "Em Vendas da rede, escolha BuyGoods ou SmartAdv, copie o URL com macros e cole no painel da plataforma.",
            },
            {
              t: "Anúncio com o link da Clickora",
              d: "Use o URL da campanha (UTMs + gclid/fbclid). O GCLID fica no clique e segue para a venda.",
            },
            {
              t: "Venda → Conversões",
              d: "A rede chama o postback; a venda aparece atribuída. Sem ID de clique, a venda ainda é registada (não atribuída) — não se perde.",
            },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  {s.t}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 max-w-2xl">
        <Link
          to="/integracoes/automizer"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground flex items-center gap-2">
              Automizer &amp; custos
              <Badge variant="secondary" className="text-[10px]">
                Pro
              </Badge>
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Sync diário Google/Meta/TikTok · pausa keywords sem receita · dry-run primeiro.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
        </Link>
        <Link
          to="/tracking/plataformas-legacy"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">1. Vendas da rede (Postback)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              BuyGoods, SmartAdv, Digistore24, Hotmart e outras. Obrigatório para conversões no painel.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Configurar postback <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        <Link
          to="/tracking/integrations-legacy"
          className="group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/40"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">2. Anúncios (Google / Meta / TikTok)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enviar vendas aprovadas com GCLID / fbclid / ttclid de volta às contas. Opcional, mas recomendado para escalar.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Ligar contas <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        {dpilot ? (
          <Link
            to="/tracking/dpilot"
            className="rounded-xl border border-dashed border-border/70 px-5 py-4 text-sm text-muted-foreground hover:bg-muted/30"
          >
            Gestão de campanhas paid (Google / Meta / TikTok) →
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground px-1">
            Gestão de campanhas paid:{" "}
            <Badge variant="secondary" className="text-[10px] mx-1">
              Pro Anual
            </Badge>
            <Link to="/planos" className="text-primary underline-offset-2 hover:underline">
              Ver planos
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
