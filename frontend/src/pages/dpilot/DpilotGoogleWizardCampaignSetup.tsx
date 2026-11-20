import type { LucideIcon } from "lucide-react";
import {
  Check,
  Megaphone,
  MousePointerClick,
  Search,
  Tag,
  UserPlus,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** Presets alinhados ao assistente Google Ads — texto completo vai para o campo `objective` do plano. */
export const GOOGLE_WIZARD_OBJECTIVES: {
  id: string;
  label: string;
  description: string;
  objective: string;
  icon: LucideIcon;
}[] = [
  {
    id: "sales",
    label: "Vendas",
    description: "Foco em compras, demos agendadas ou conversões com retorno.",
    objective:
      "Gerar demos agendadas ou compras/conversões com foco em retorno sobre investimento.",
    icon: Tag,
  },
  {
    id: "leads",
    label: "Leads",
    description: "Contactos e acções que geram leads qualificados.",
    objective:
      "Gerar pedidos de contacto ou inscrições qualificadas com custo por lead sob controlo.",
    icon: UserPlus,
  },
  {
    id: "traffic",
    label: "Tráfego do site",
    description: "Tráfego qualificado para a landing com CPC sob controlo.",
    objective: "Aumentar visitas qualificadas à landing e melhorar o custo médio por clique.",
    icon: MousePointerClick,
  },
  {
    id: "brand",
    label: "Marca / alcance",
    description: "Notoriedade e presença em pesquisas relevantes para a marca.",
    objective: "Aumentar notoriedade e presença em pesquisas relevantes para a marca.",
    icon: Megaphone,
  },
];

export type GoogleWizardChannelId = "search";

export function DpilotGoogleWizardObjectiveStep({
  objective,
  onObjectiveChange,
}: {
  objective: string;
  onObjectiveChange: (value: string) => void;
}) {
  const selectedId = GOOGLE_WIZARD_OBJECTIVES.find((o) => o.objective === objective.trim())?.id ?? null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">Qual é o objetivo?</h3>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Preenche o briefing do plano (nome, keywords, RSA). O leilão na Google segue a{" "}
          <strong className="font-medium text-foreground">estratégia de licitação</strong> do passo Orçamento.
        </p>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        role="radiogroup"
        aria-label="Objetivo da campanha"
      >
        {GOOGLE_WIZARD_OBJECTIVES.map((o) => {
          const Icon = o.icon;
          const selected = selectedId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onObjectiveChange(o.objective)}
              className={cn(
                "group relative flex w-full flex-col rounded-xl border bg-card p-4 text-left transition-colors",
                "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary/50 bg-primary/[0.06] ring-1 ring-primary/25" : "border-border/80",
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
              ) : null}
              <div
                className={cn(
                  "mb-3 flex h-10 w-10 items-center justify-center rounded-lg border bg-background/80",
                  selected ? "border-primary/40 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <span className="font-semibold text-foreground">{o.label}</span>
              <span className="mt-1 text-[12px] leading-snug text-muted-foreground">{o.description}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-border/50 pt-4">
        <label htmlFor="g-wiz-objective-refine" className="text-xs font-medium text-foreground">
          Detalhe o briefing (editável)
        </label>
        <textarea
          id="g-wiz-objective-refine"
          rows={2}
          maxLength={200}
          value={objective}
          onChange={(e) => onObjectiveChange(e.target.value)}
          placeholder='Ex.: "Vendas: gerar compras com ROAS mínimo 3."'
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          required
        />
        <p className="text-right text-[11px] tabular-nums text-muted-foreground">{objective.length}/200</p>
      </div>
    </div>
  );
}

export function DpilotGoogleWizardCampaignTypeStep() {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-foreground">
        <Search className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-foreground">
          Pesquisa Google{" "}
          <span className="ml-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">única opção</span>
        </p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Campanha Search com keywords e RSA. PMax / Display / vídeo ficam na consola Google.
        </p>
      </div>
    </div>
  );
}

/** @deprecated Removido do fluxo — numeração falsa «Configuração 3». Mantido para imports legados. */
export function DpilotGoogleWizardDetailsStepHeader() {
  return null;
}
