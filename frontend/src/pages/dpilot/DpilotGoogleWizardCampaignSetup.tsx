import type { LucideIcon } from "lucide-react";
import {
  Check,
  Images,
  LayoutDashboard,
  LayoutPanelLeft,
  Megaphone,
  MousePointerClick,
  Search,
  ShoppingBag,
  Tag,
  UserPlus,
  Video,
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

export type GoogleWizardChannelId =
  | "performance_max"
  | "search"
  | "demand_gen"
  | "video"
  | "display"
  | "shopping";

const CHANNEL_CARDS: {
  id: GoogleWizardChannelId;
  label: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
}[] = [
  {
    id: "performance_max",
    label: "Performance Max",
    description: "Multi-canal (Pesquisa, YouTube, Display…). Ainda não disponível neste assistente.",
    icon: LayoutDashboard,
    enabled: false,
  },
  {
    id: "search",
    label: "Pesquisar",
    description: "Anúncios de texto na Pesquisa Google — palavras-chave, RSA e o assistente de decisão.",
    icon: Search,
    enabled: true,
  },
  {
    id: "demand_gen",
    label: "Geração de demanda",
    description: "Demanda e conversões com anúncios gráficos e vídeo em várias superfícies.",
    icon: Images,
    enabled: false,
  },
  {
    id: "video",
    label: "Vídeo",
    description: "Campanhas de vídeo no YouTube e parceiros.",
    icon: Video,
    enabled: false,
  },
  {
    id: "display",
    label: "Rede de Display",
    description: "Alcance em sites e apps da Rede de Display.",
    icon: LayoutPanelLeft,
    enabled: false,
  },
  {
    id: "shopping",
    label: "Shopping",
    description: "Anúncios de produto via Merchant Center.",
    icon: ShoppingBag,
    enabled: false,
  },
];

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-sm dark:bg-violet-500"
        aria-hidden
      >
        {step}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700/90 dark:text-violet-300/90">
        {label}
      </span>
    </div>
  );
}

export function DpilotGoogleWizardObjectiveStep({
  objective,
  onObjectiveChange,
}: {
  objective: string;
  onObjectiveChange: (value: string) => void;
}) {
  const selectedId = GOOGLE_WIZARD_OBJECTIVES.find((o) => o.objective === objective.trim())?.id ?? null;

  return (
    <section className="space-y-4 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/[0.06] to-transparent p-5 shadow-sm dark:from-violet-500/[0.09] dark:to-transparent">
      <div className="space-y-1">
        <StepBadge step={1} label="Objetivo" />
        <h2 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
          Qual é o objetivo da campanha?
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          O cartão que escolher preenche um <strong className="font-medium text-foreground">briefing em texto</strong>{" "}
          para o plano: nome da campanha, palavras-chave sugeridas e copy dos anúncios (RSA). Isto orienta a nossa IA —
          <strong className="font-medium text-foreground"> não</strong> substitui o campo de «objetivo» do Google Ads.
          Na conta Google, o que o leilão optimiza vem sobretudo da{" "}
          <strong className="font-medium text-foreground">estratégia de licitação</strong> que definir no passo de
          configuração (e das conversões / dados ligados à conta).
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
                "group relative flex w-full flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-all",
                "hover:border-violet-400/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                selected
                  ? "border-violet-500 bg-violet-500/[0.08] ring-1 ring-violet-500/35 dark:bg-violet-500/[0.12]"
                  : "border-border/80",
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white dark:bg-violet-500">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
              ) : null}
              <div
                className={cn(
                  "mb-3 flex h-10 w-10 items-center justify-center rounded-lg border bg-background/80",
                  selected ? "border-violet-500/40 text-violet-700 dark:text-violet-300" : "text-muted-foreground",
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

      <div className="space-y-2 border-t border-border/60 pt-4">
        <label htmlFor="g-wiz-objective-refine" className="text-xs font-medium text-foreground">
          Detalhe ou personalize o objetivo (briefing para o plano)
        </label>
        <textarea
          id="g-wiz-objective-refine"
          rows={2}
          maxLength={200}
          value={objective}
          onChange={(e) => onObjectiveChange(e.target.value)}
          placeholder='Ex.: "Vendas: gerar compras com ROAS mínimo 3; refinar palavras de compra."'
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          required
        />
        <p className="text-right text-[11px] tabular-nums text-muted-foreground">{objective.length}/200</p>
      </div>
    </section>
  );
}

export function DpilotGoogleWizardCampaignTypeStep() {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
      <div className="space-y-1">
        <StepBadge step={2} label="Tipo" />
        <h2 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
          Tipo de campanha
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Ao <strong className="font-medium text-foreground">publicar</strong> na Google, criamos sempre uma campanha de{" "}
          <strong className="font-medium text-foreground">Pesquisa (Search)</strong>:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">advertisingChannelType: SEARCH</code>, rede de
          pesquisa, palavras-chave e RSA. O cartão <strong className="font-medium text-foreground">Pesquisar</strong>{" "}
          é o único ativo; os restantes aparecem só como referência («em breve») e{" "}
          <strong className="font-medium text-foreground">não</strong> alteram o pedido à API.
        </p>
      </div>

      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="Tipos de campanha Google Ads"
      >
        {CHANNEL_CARDS.map((c) => {
          const Icon = c.icon;
          const selected = c.enabled && c.id === "search";
          const disabled = !c.enabled;
          return (
            <div
              key={c.id}
              role="listitem"
              className={cn(
                "relative flex flex-col rounded-xl border p-4 transition-all",
                selected && "border-emerald-500/50 bg-emerald-500/[0.07] ring-1 ring-emerald-500/30 dark:bg-emerald-500/[0.1]",
                disabled && "border-dashed border-muted-foreground/25 bg-muted/20 opacity-80",
                !selected && !disabled && "border-border bg-card",
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
              ) : null}
              {!c.enabled ? (
                <span className="absolute right-3 top-3 rounded-full border border-muted-foreground/30 bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Em breve
                </span>
              ) : null}
              <div
                className={cn(
                  "mb-3 flex h-10 w-10 items-center justify-center rounded-lg border bg-background/90",
                  selected ? "border-emerald-500/40 text-emerald-800 dark:text-emerald-200" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <span className="font-semibold text-foreground">{c.label}</span>
              <span className="mt-1 text-[12px] leading-snug text-muted-foreground">{c.description}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Marcador visual do passo seguinte (detalhes da campanha). */
export function DpilotGoogleWizardDetailsStepHeader() {
  return (
    <div className="space-y-2 border-b border-border/70 pb-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <StepBadge step={3} label="Configuração" />
        <span className="text-sm text-muted-foreground">
          Landing, orçamento,{" "}
          <span className="font-medium text-foreground">licitação (o que o Google optimiza)</span>, segmentação e
          palavras-chave
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Resumo: passo 1 = briefing para o plano e anúncios · passo 2 = tipo{" "}
        <strong className="font-medium text-foreground">Search</strong> na publicação · abaixo = opções que a API Google
        aplica ao leilão (orçamento, licitação, geo, idiomas).
      </p>
    </div>
  );
}
