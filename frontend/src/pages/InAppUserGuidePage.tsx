import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DashboardUserGuide } from "@/components/DashboardUserGuide";
import { APP_PAGE_SHELL } from "@/lib/appPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Guia de instruções **dentro** da app (após login), além do resumo no /inicio e do cartão
 * replegável no Rastreamento. O artigo em /guia-vendas-afiliados continua a ser a versão
 * pública (SEO); este ecrã é o “manual de utilização” no painel.
 */
export default function InAppUserGuidePage() {
  return (
    <div className={APP_PAGE_SHELL}>
      <PageHeader
        title="Guia da aplicação"
        description="Leia aqui os passos depois de entrar: presell no link /p/… (medição automática) ou script só para HTML externo, links com UTMs e macros, postbacks, integrações e anúncios. Pode abrir qualquer ecrã a partir dos botões em cada bloco. O Rastreamento mostra ainda um resumo replegável; se o ocultou, em Perfil → Ajuda no dashboard pode voltar a exibi-lo."
      />

      <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
        Este guia é o mesmo conteúdo do cartão de boas-vindas e do <strong className="text-foreground/90">Resumo e guia</strong> do
        rastreamento, reunidos numa página — para consultar a qualquer altura, sem procurar no site público.
      </p>

      <div className="space-y-8 max-w-4xl">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Entrada: o que fazer primeiro
          </h2>
          <DashboardUserGuide variant="home" allowDismiss={false} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-2">Do clique à venda (passo a passo)</h2>
          <DashboardUserGuide variant="tracking" allowDismiss={false} />
        </div>
      </div>

      <Card className="max-w-4xl border-border/60 bg-muted/20">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Artigo longo (site público)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Versão com texto orientado a SEO (presell, tracking, erros comuns). Abre a mesma app, sem a barra do painel.
            </p>
          </div>
          <Button variant="secondary" className="shrink-0 gap-2" asChild>
            <Link to="/guia-vendas-afiliados">
              Abrir artigo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
