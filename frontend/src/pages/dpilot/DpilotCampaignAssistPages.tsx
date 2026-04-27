import { Link } from "react-router-dom";
import { CheckCircle2, FileCode2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gate } from "./DpilotPaidPages";
import { useDpilotPaid } from "./DpilotPaidContext";

function PipelineCard({
  description,
  referencePath,
  steps,
  footnote,
}: {
  description: string;
  referencePath: string;
  steps: string[];
  footnote: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Referência no repositório</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Ficheiro de origem: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{referencePath}</code>
        </p>
        <ol className="list-inside list-decimal space-y-1.5">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="text-xs leading-relaxed border-t border-border/60 pt-3">{footnote}</p>
      </CardContent>
    </Card>
  );
}

function NextActions() {
  const { projectId } = useDpilotPaid();
  const b = `/tracking/dpilot/p/${projectId}`;
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      <Button asChild>
        <Link to={`${b}/aprovacoes`}>Aprovações</Link>
      </Button>
      <Button asChild variant="outline">
        <Link to={`${b}/ligacoes`}>Ligações (OAuth)</Link>
      </Button>
      <Button asChild variant="outline">
        <Link to={`${b}/campanhas`}>Todas as campanhas</Link>
      </Button>
    </div>
  );
}

export function DpilotMetaNovaPage() {
  const { projectId } = useDpilotPaid();
  const b = `/tracking/dpilot/p/${projectId}`;
  return (
    <Gate>
      <PageHeader
        title="Nova campanha Meta"
        description="Fluxo de assistente equivalente ao wizard do app de referência (criação assistida, criativos e plano de campanha)."
      />
      <div className="mt-4 space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Estado no monólito</CardTitle>
            </div>
            <CardDescription>
              O assistente em ecrã completo ainda depende de expor, na API pública, o mesmo contrato que o
              protótipo chama via server functions. Enquanto isso, prepara a conta, vê o pipeline de aprovação e
              a lista de campanhas.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Ligação OAuth Meta e rascunhos alinhados a <code className="text-xs">change_requests</code>.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Publicação e alterações no backend já existem em módulos <code className="text-xs">meta-ads.*</code>.
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link to={`${b}/meta/campanhas`}>Ver campanhas Meta</Link>
              </Button>
            </div>
            <NextActions />
          </CardContent>
        </Card>
        <PipelineCard
          description="No dpilotoaut, o ecrã completo e uploads usam funções de servidor (TanStack Start)."
          referencePath="dpilotoaut/frontend/src/routes/app.projects.$projectId.paid.meta.wizard.tsx"
          steps={[
            "Gera plano: generateMetaCampaignPlan (meta-plan.functions).",
            "Criativos: uploadMetaCreativeAsset / deleteMetaCreativeAsset.",
            "Aprova e publica via fluxo de projecto + Graph API, espelhado no monólito em change-request-apply e meta-ads.publish.",
          ]}
          footnote="O mapa detalhado ficheiro a ficheiro está em docs/DPILOT-PARITY.md."
        />
      </div>
    </Gate>
  );
}

export function DpilotGoogleNovaPage() {
  const { projectId } = useDpilotPaid();
  const b = `/tracking/dpilot/p/${projectId}`;
  return (
    <Gate>
      <PageHeader
        title="Nova campanha Google Ads"
        description="Fluxo alinhado a «paid/campaigns/new» no app de referência (plano e pedidos de alteração)."
      />
      <div className="mt-4 space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Estado no monólito</CardTitle>
            </div>
            <CardDescription>
              O formulário de assistente (URL, oferta, orçamento, localização/idioma) ainda não está ligado a um
              endpoint <code className="text-xs">POST</code> único; o backend já aplica rascunhos e publica via Google
              Ads no fluxo aprovado. Usa a lista de campanhas e as aprovações para acompanhar o processo.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                OAuth de anunciante e listagem vêm de <code className="text-xs">/api/paid/*</code>.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                Publicação local → Google: <code className="text-xs">google-ads.publish</code> (após aprovação).
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <Link to={`${b}/google`}>Google Ads (OAuth)</Link>
              </Button>
            </div>
            <NextActions />
          </CardContent>
        </Card>
        <PipelineCard
          description="Prototótipo com geração de plano (AI) e depois criação local de rascunhos."
          referencePath="dpilotoaut/frontend/src/routes/app.projects.$projectId.paid.campaigns.new.tsx"
          steps={[
            "Chamada: generateCampaignPlan (ai-plan.functions).",
            "Persistência de campanha Google no mesmo projecto, depois publish/guarda.",
            "Paridade: ver docs/DPILOT-PARITY.md e rotas em backend/src/routes/paid.routes.ts.",
          ]}
          footnote="Quando a API pública alinhar o contrato, este ecrã pode alojar o mesmo formulário com submit real."
        />
      </div>
    </Gate>
  );
}
