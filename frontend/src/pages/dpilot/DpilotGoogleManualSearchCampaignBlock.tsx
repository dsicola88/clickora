import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { GoogleRsaDescriptionsFieldStack, GoogleRsaHeadlinesFieldStack } from "@/components/dpilot/GoogleRsaLineEditors";
import {
  type GoogleManualPlanFormState,
  newAdGroupRow,
  parseGoogleManualKeywordLines,
} from "./googleManualSearchPlanForm";
import { StudioSettingsRow } from "./dpilotGoogleStudioSettingsUi";

export type GoogleSearchPlanConstructionMode = "assistant" | "manual";

/** Valores dos passos Orçamento/Geo — resumo no painel de estrutura (passo Palavras-chave). */
export type GoogleManualWizardContextPreview = {
  dailyBudgetUsd?: string;
  biddingStrategyLabel?: string;
  geoSummary?: string;
  languageSummary?: string;
};

/** Escolha Com IA / Manual — fica no passo Landing (só a decisão). */
export function DpilotGoogleSearchPlanModePicker(props: {
  mode: GoogleSearchPlanConstructionMode;
  onModeChange: (mode: GoogleSearchPlanConstructionMode) => void;
}) {
  const { mode, onModeChange } = props;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold tracking-tight text-foreground">Como construir a campanha</p>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Só Pesquisa. A estrutura (grupos, keywords, RSA) aparece no passo{" "}
          <strong className="font-medium text-foreground">Palavras-chave</strong> conforme a via.
        </p>
      </div>
      <div
        className="grid grid-cols-2 gap-0 rounded-lg border border-border/70 bg-background p-1"
        role="radiogroup"
        aria-label="Via de construção"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "assistant"}
          id="google-mode-ai"
          onClick={() => onModeChange("assistant")}
          className={cn(
            "rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
            mode === "assistant" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Com IA
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "manual"}
          id="google-mode-manual"
          onClick={() => onModeChange("manual")}
          className={cn(
            "rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
            mode === "manual" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Manual
        </button>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        {mode === "assistant"
          ? "A IA propõe grupos, keywords e RSA a partir do briefing. Revê no estúdio depois de gerar."
          : "No passo Palavras-chave define nome, grupos, keywords e RSA. Orçamento e geo ficam nos passos a seguir."}
      </p>
    </div>
  );
}

/** Estrutura manual — vive no passo Palavras-chave (índice honesto). */
export function DpilotGoogleManualSearchStructurePanel(props: {
  manualForm: GoogleManualPlanFormState;
  onManualFormChange: React.Dispatch<React.SetStateAction<GoogleManualPlanFormState>>;
  wizardContextPreview?: GoogleManualWizardContextPreview;
}) {
  const { manualForm: f, onManualFormChange, wizardContextPreview: wc } = props;

  const updateAg = (id: string, patch: Partial<GoogleManualPlanFormState["adGroups"][number]>) => {
    onManualFormChange((prev) => ({
      ...prev,
      adGroups: prev.adGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  };

  const removeAg = (id: string) => {
    onManualFormChange((prev) =>
      prev.adGroups.length <= 1 ? prev : { ...prev, adGroups: prev.adGroups.filter((g) => g.id !== id) },
    );
  };

  const addAg = () => {
    onManualFormChange((prev) => ({
      ...prev,
      adGroups: [...prev.adGroups, newAdGroupRow(`Grupo ${prev.adGroups.length + 1}`)].slice(0, 5),
    }));
  };

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Estrutura Search: campanha, grupos, keywords e RSA. Orçamento e geo já definidos acima (resumo).
      </p>

      <div className="overflow-hidden rounded-lg border border-border/70">
        <section id="manual-sec-campanha" className="scroll-mt-24">
          <Collapsible defaultOpen className="group/collapsible">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
              <span>Campanha</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/50 bg-muted/10">
                <StudioSettingsRow
                  label="Estado"
                  value={<span className="text-muted-foreground">Rascunho — ainda não na Google</span>}
                />
                <StudioSettingsRow
                  label="Nome"
                  value={
                    <Input
                      id="manual-campaign-name"
                      className="h-9 max-w-lg"
                      value={f.campaignName}
                      maxLength={250}
                      onChange={(e) => onManualFormChange((p) => ({ ...p, campaignName: e.target.value }))}
                      placeholder="Ex.: Marca · Pesquisa · Mercado"
                    />
                  }
                />
                <StudioSettingsRow
                  label="Notas internas"
                  value={
                    <TextareaNotes
                      value={f.objectiveSummary}
                      onChange={(v) => onManualFormChange((p) => ({ ...p, objectiveSummary: v }))}
                    />
                  }
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        <section id="manual-sec-redes" className="scroll-mt-24 border-t border-border/50">
          <Collapsible defaultOpen className="group/r">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
              <span>Rede</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/r:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border/50">
                <StudioSettingsRow label="Tipo" value={<span className="font-medium">Pesquisa Google</span>} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        <section id="manual-sec-orcamento" className="scroll-mt-24 border-t border-border/50">
          <Collapsible defaultOpen className="group/o">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
              <span>Orçamento e geo (resumo)</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/o:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="divide-y divide-border/50 border-t border-border/50">
                <StudioSettingsRow
                  label="Orçamento / dia"
                  value={
                    wc?.dailyBudgetUsd?.trim() ? (
                      <span className="font-mono text-[13px] font-medium">{wc.dailyBudgetUsd.trim()} USD</span>
                    ) : (
                      <span className="italic text-muted-foreground">Ver passo Orçamento</span>
                    )
                  }
                />
                <StudioSettingsRow
                  label="Licitação"
                  value={
                    wc?.biddingStrategyLabel ? (
                      <span>{wc.biddingStrategyLabel}</span>
                    ) : (
                      <span className="italic text-muted-foreground">Ver passo Orçamento</span>
                    )
                  }
                />
                <StudioSettingsRow
                  label="Mercados"
                  value={
                    wc?.geoSummary?.trim() ? (
                      <span className="font-mono text-xs">{wc.geoSummary}</span>
                    ) : (
                      <span className="italic text-muted-foreground">Ver passo Geo</span>
                    )
                  }
                />
                <StudioSettingsRow
                  label="Idiomas"
                  value={
                    wc?.languageSummary?.trim() ? (
                      <span className="font-mono text-xs">{wc.languageSummary}</span>
                    ) : (
                      <span className="italic text-muted-foreground">Ver passo Geo</span>
                    )
                  }
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        <section id="manual-sec-publico-grupos" className="scroll-mt-24 border-t border-border/50">
          <Collapsible defaultOpen className="group/p">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40">
              <span>Grupos · keywords · RSA</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/p:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-4 border-t border-border/50 bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Grupos (máx. 5)</p>
                  <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => void addAg()}>
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    Novo grupo
                  </Button>
                </div>

                {f.adGroups.map((ag, gi) => {
                  const kwCount = parseGoogleManualKeywordLines(ag.keywordsText).length;
                  return (
                    <div key={ag.id} className="space-y-4 rounded-lg border border-border/60 bg-background p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="grid min-w-0 flex-1 gap-1.5">
                          <Label htmlFor={`ag-name-${ag.id}`} className="text-[11px]">
                            Grupo {gi + 1}
                          </Label>
                          <Input
                            id={`ag-name-${ag.id}`}
                            value={ag.name}
                            maxLength={255}
                            onChange={(e) => updateAg(ag.id, { name: e.target.value })}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          disabled={f.adGroups.length <= 1}
                          onClick={() => removeAg(ag.id)}
                          aria-label="Remover grupo"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>

                      <Separator className="opacity-50" />

                      <div className="space-y-1.5">
                        <Label htmlFor={`ag-kw-${ag.id}`} className="text-[11px]">
                          Palavras-chave ({kwCount}) — uma por linha. Prefixo{" "}
                          <code className="text-[10px]">exact</code> / <code className="text-[10px]">phrase</code> /{" "}
                          <code className="text-[10px]">broad</code>
                        </Label>
                        <textarea
                          id={`ag-kw-${ag.id}`}
                          rows={4}
                          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder={"exact marca\nphrase comprar online\nproduto"}
                          value={ag.keywordsText}
                          onChange={(e) => updateAg(ag.id, { keywordsText: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
                        <GoogleRsaHeadlinesFieldStack
                          value={ag.headlinesText}
                          onChange={(next) => updateAg(ag.id, { headlinesText: next })}
                        />
                        <GoogleRsaDescriptionsFieldStack
                          value={ag.descriptionsText}
                          onChange={(next) => updateAg(ag.id, { descriptionsText: next })}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Titulares ≤30 · descrições ≤90. Os mesmos mínimos RSA do modo Com IA.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </div>
    </div>
  );
}

function TextareaNotes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      id="manual-objective-summary"
      rows={2}
      className="flex max-w-lg w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      maxLength={500}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Só para si — não vai para os anúncios."
    />
  );
}

/** @deprecated Prefer ModePicker + StructurePanel — mantido se algum import legado existir. */
export function DpilotGoogleManualSearchCampaignBlock(props: {
  mode: GoogleSearchPlanConstructionMode;
  onModeChange: (mode: GoogleSearchPlanConstructionMode) => void;
  manualForm: GoogleManualPlanFormState;
  onManualFormChange: React.Dispatch<React.SetStateAction<GoogleManualPlanFormState>>;
  wizardContextPreview?: GoogleManualWizardContextPreview;
}) {
  return (
    <div className="space-y-6">
      <DpilotGoogleSearchPlanModePicker mode={props.mode} onModeChange={props.onModeChange} />
      {props.mode === "manual" ? (
        <DpilotGoogleManualSearchStructurePanel
          manualForm={props.manualForm}
          onManualFormChange={props.onManualFormChange}
          wizardContextPreview={props.wizardContextPreview}
        />
      ) : null}
    </div>
  );
}
