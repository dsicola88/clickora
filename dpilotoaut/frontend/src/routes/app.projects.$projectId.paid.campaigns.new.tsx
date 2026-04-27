import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";

import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateCampaignPlan } from "@/server/ai-plan.functions";

export const Route = createFileRoute("/app/projects/$projectId/paid/campaigns/new")({
  component: NewCampaignWizard,
});

const schema = z.object({
  landingUrl: z.string().url("Informe uma URL válida").max(500),
  offer: z.string().trim().min(3, "Descreva a oferta").max(500),
  objective: z.string().trim().min(3).max(200),
  dailyBudgetUsd: z.number().min(1).max(100000),
  geoTargets: z.string().trim().min(2).max(200),
  languageTargets: z.string().trim().min(2).max(100),
});

function NewCampaignWizard() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const generate = useServerFn(generateCampaignPlan);

  const [landingUrl, setLandingUrl] = useState("https://example.com");
  const [offer, setOffer] = useState("");
  const [objective, setObjective] = useState("Gerar cadastros de teste grátis");
  const [dailyBudget, setDailyBudget] = useState("25");
  const [geos, setGeos] = useState("BR, PT");
  const [langs, setLangs] = useState("pt");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({
      landingUrl,
      offer,
      objective,
      dailyBudgetUsd: Number(dailyBudget),
      geoTargets: geos,
      languageTargets: langs,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSubmitting(true);
    try {
      const res = await generate({
        data: {
          projectId,
          landingUrl: parsed.data.landingUrl,
          offer: parsed.data.offer,
          objective: parsed.data.objective,
          dailyBudgetUsd: parsed.data.dailyBudgetUsd,
          geoTargets: parsed.data.geoTargets
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
          languageTargets: parsed.data.languageTargets
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        },
      });
      if (!res.ok) {
        setError(res.error);
        toast.error("Falha ao gerar plano", { description: res.error });
        return;
      }
      if (res.autoApplied) {
        toast.success("Plano aplicado pelo Autopilot", {
          description: "Dentro dos guardrails — campanha publicada (simulado).",
        });
      } else if (res.reasons && res.reasons.length > 0) {
        toast.warning("Plano enviado para aprovação", {
          description: res.reasons[0]?.message ?? "Fora dos guardrails.",
        });
      } else {
        toast.success("Plano gerado · enviado para aprovação");
      }
      navigate({
        to: "/app/projects/$projectId/paid/approvals",
        params: { projectId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(msg);
      toast.error("Falha ao gerar plano", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-12">
      <PageHeader
        title="Nova campanha"
        description="Gere um plano de Google Ads Search com IA. Tudo passa por aprovação antes de publicar."
        badge={<Badge variant="soft">IA · Copilot</Badge>}
        actions={
          <Button variant="ghost" asChild>
            <Link to="/app/projects/$projectId/paid/campaigns" params={{ projectId }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl px-6 py-6 sm:px-8">
        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          <Field label="URL da landing page" hint="Para onde o clique no anúncio leva.">
            <Input
              type="url"
              value={landingUrl}
              onChange={(e) => setLandingUrl(e.target.value)}
              required
            />
          </Field>
          <Field
            label="Oferta / proposta de valor"
            hint="Uma ou duas frases. Vai virar texto de anúncio."
          >
            <Textarea
              rows={3}
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="ex.: Agente de IA que automatiza Google Ads com guardrails de segurança"
              required
            />
          </Field>
          <Field label="Objetivo">
            <Input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Gerar cadastros de teste grátis"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Orçamento diário (USD)">
              <Input
                type="number"
                min={1}
                step="0.01"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                required
              />
            </Field>
            <Field label="Geo (alvos)" hint="Códigos ISO-2, separados por vírgula.">
              <Input
                value={geos}
                onChange={(e) => setGeos(e.target.value)}
                placeholder="BR, PT, US"
                required
              />
            </Field>
            <Field label="Idiomas">
              <Input
                value={langs}
                onChange={(e) => setLangs(e.target.value)}
                placeholder="pt"
                required
              />
            </Field>
          </div>

          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              O plano cria entidades em rascunho + um pedido de mudança pendente. Nada é publicado.
            </p>
            <Button type="submit" disabled={submitting}>
              <Sparkles className="mr-1 h-4 w-4" />
              {submitting ? "Gerando plano…" : "Gerar plano"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
