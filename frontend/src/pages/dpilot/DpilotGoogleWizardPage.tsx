import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { paidAdsService } from "@/services/paidAdsService";
import { Gate } from "./DpilotPaidPages";
import { useDpilotPaid } from "./DpilotPaidContext";

const schema = z.object({
  landingUrl: z.string().url("Informe uma URL válida").max(500),
  offer: z.string().trim().min(3, "Descreva a oferta").max(500),
  objective: z.string().trim().min(3).max(200),
  dailyBudgetUsd: z.number().min(1).max(100000),
  geoTargets: z.string().trim().min(2).max(200),
  languageTargets: z.string().trim().min(2).max(100),
});

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
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DpilotGoogleWizardPage() {
  const { projectId } = useDpilotPaid();
  const navigate = useNavigate();
  const base = `/tracking/dpilot/p/${projectId}`;

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
    const geoArr = parsed.data.geoTargets
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20);
    if (!geoArr.length) {
      setError("Indique pelo menos um país (código ISO, ex.: BR, PT).");
      return;
    }
    const langArr = parsed.data.languageTargets
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);
    if (!langArr.length) {
      setError("Indique pelo menos um idioma (ex.: pt, en).");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: apiErr } = await paidAdsService.postGoogleCampaignPlan(projectId, {
        landingUrl: parsed.data.landingUrl,
        offer: parsed.data.offer,
        objective: parsed.data.objective,
        dailyBudgetUsd: parsed.data.dailyBudgetUsd,
        geoTargets: geoArr,
        languageTargets: langArr,
      });
      if (apiErr || !data?.ok) {
        const msg = apiErr || "Falha ao gerar plano";
        setError(msg);
        toast.error("Falha ao gerar plano", { description: msg });
        return;
      }
      if (data.autoApplied) {
        toast.success("Plano aplicado pelo Autopilot", {
          description: "Dentro dos guardrails — publicação no Google tentada.",
        });
      } else if (data.reasons && data.reasons.length > 0) {
        toast.warning("Plano enviado para aprovação", {
          description: data.reasons[0]?.message ?? "Ver guardrails e fila de aprovações.",
        });
      } else {
        toast.success("Plano gerado", { description: "Rascunho e pedido criados. Revise em aprovações." });
      }
      navigate(`${base}/aprovacoes`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(msg);
      toast.error("Falha ao gerar plano", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Gate>
      <div className="pb-12">
        <PageHeader
          title="Nova campanha"
          description="Gere um plano de Google Ads Search com IA. Tudo passa por aprovação antes de publicar (excepto Autopilot com guardrails). "
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                IA · Search
              </Badge>
              <Button variant="ghost" asChild>
                <Link to={`${base}/campanhas`}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                </Link>
              </Button>
            </div>
          }
        />
        <div className="mx-auto max-w-3xl px-0 py-4 sm:px-1 sm:py-6">
          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
          >
            <Field label="URL da landing page" hint="Para onde o clique no anúncio leva.">
              <Input type="url" value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} required />
            </Field>
            <Field
              label="Oferta / proposta de valor"
              hint="Uma ou duas frases. Vai alimentar o RSA e o plano."
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
              <Field label="Idiomas" hint="Códigos de idioma (ex.: pt, en).">
                <Input value={langs} onChange={(e) => setLangs(e.target.value)} placeholder="pt" required />
              </Field>
            </div>

            {error ? (
              <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground max-w-md">
                O plano cria rascunhos (campanha, grupos, palavras-chave, RSA) e um pedido de criação. Nada publica
                enquanto os guardrails ou o Copilot o exigirem.
              </p>
              <Button type="submit" disabled={submitting}>
                <Sparkles className="mr-1 h-4 w-4" />
                {submitting ? "A gerar plano…" : "Gerar plano"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Gate>
  );
}
