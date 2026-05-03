import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  type GoogleManualPlanFormState,
  newAdGroupRow,
  parseGoogleManualKeywordLines,
  rsaLines,
} from "./googleManualSearchPlanForm";
import { StudioSettingsRow } from "./dpilotGoogleStudioSettingsUi";

export type GoogleSearchPlanConstructionMode = "assistant" | "manual";

/** Valores já escolhidos no assistente antes do passo da landing — resumo só de leitura (estilo definições da Google). */
export type GoogleManualWizardContextPreview = {
  dailyBudgetUsd?: string;
  biddingStrategyLabel?: string;
  geoSummary?: string;
  languageSummary?: string;
};

export function DpilotGoogleManualSearchCampaignBlock(props: {
  mode: GoogleSearchPlanConstructionMode;
  onModeChange: (mode: GoogleSearchPlanConstructionMode) => void;
  manualForm: GoogleManualPlanFormState;
  onManualFormChange: React.Dispatch<React.SetStateAction<GoogleManualPlanFormState>>;
  /** Estado actual dos passos seguintes/anteriores do assistente (orçamento, licitação, geo) para alinhar o painel manual ao Gestor Pesquisa. */
  wizardContextPreview?: GoogleManualWizardContextPreview;
}) {
  const { mode, onModeChange, manualForm: f, onManualFormChange, wizardContextPreview } = props;

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

  const wc = wizardContextPreview;

  return (
    <Card className="border-muted-foreground/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base tracking-tight">Modo de construção antes da publicação</CardTitle>
        <CardDescription className="space-y-2 text-muted-foreground">
          <span className="block leading-relaxed">
            Este assistente gere unicamente campanhas de <strong className="text-foreground font-medium">Pesquisa</strong> —
            hierarquia padrão: campanha, grupos de anúncios, palavras‑chave (correspondências exacta, expressão ou ampla) e
            anúncio de pesquisa responsivo (RSA). Performance&nbsp;Max, Display, vídeo ou Shopping configuram‑se na consola da
            Google.
          </span>
          <span className="block leading-relaxed text-[12px]">
            O modo manual abre um painel <strong className="text-foreground font-medium">tipo definições de campanha</strong> —
            igualmente simples aqui dentro. Depois da publicação, personalize na lista{" "}
            <strong className="text-foreground font-medium">Campanhas → Gestão</strong>.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={mode} onValueChange={(v) => onModeChange(v as GoogleSearchPlanConstructionMode)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label
              className={`flex cursor-pointer rounded-lg border p-4 ${mode === "assistant" ? "border-primary/50 bg-muted/40" : "border-border hover:bg-muted/20"}`}
            >
              <RadioGroupItem value="assistant" id="google-mode-ai" className="mt-0.5" />
              <div className="ml-3 space-y-1">
                <span className="text-sm font-medium leading-snug tracking-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Sugestão assistida pela IA
                </span>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Proposta de grupos, palavras‑chave e variações de RSA fundamentada no briefing — é sempre editável até
                  criar.
                </p>
              </div>
            </Label>
            <Label
              className={`flex cursor-pointer rounded-lg border p-4 ${mode === "manual" ? "border-primary/50 bg-muted/40" : "border-border hover:bg-muted/20"}`}
            >
              <RadioGroupItem value="manual" id="google-mode-manual" className="mt-0.5" />
              <div className="ml-3 space-y-1">
                <span className="text-sm font-medium leading-snug tracking-tight">
                  Planeamento manual (painel Gestor Pesquisa)
                </span>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Secções agrupadas como na Google Ads: campanha, redes, síntese de orçamento e licitação, grupos com
                  palavras‑chave e RSA. Sem modelo de IA ao gerar o plano — só estruturas que definir aqui.
                </p>
              </div>
            </Label>
          </div>
        </RadioGroup>

        {mode === "manual" ? (
          <div className="space-y-5">
            {/* Navegação compacta típica de menu lateral — apenas âncoras, sem complexidade */}
            <div className="-mx-1 flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1 text-[11px] text-muted-foreground">
              <a href="#manual-sec-campanha" className="rounded-md px-2 py-1 font-medium hover:bg-muted">
                Campanha
              </a>
              <span className="self-center opacity-40" aria-hidden>
                ·
              </span>
              <a href="#manual-sec-redes" className="rounded-md px-2 py-1 hover:bg-muted">
                Redes
              </a>
              <span className="self-center opacity-40" aria-hidden>
                ·
              </span>
              <a href="#manual-sec-orcamento" className="rounded-md px-2 py-1 hover:bg-muted">
                Orçamento e lances
              </a>
              <span className="self-center opacity-40" aria-hidden>
                ·
              </span>
              <a href="#manual-sec-publico-grupos" className="rounded-md px-2 py-1 hover:bg-muted">
                Grupos e conteúdo
              </a>
            </div>

            <div className="space-y-3 rounded-xl border border-border/80 bg-card">
              {/* Campanha — estilo lista de linhas */}
              <section id="manual-sec-campanha" className="scroll-mt-28">
                <Collapsible defaultOpen className="group/collapsible">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30">
                    <span>Campanha</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-180" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="">
                    <div className="border-b border-border/40 bg-muted/10">
                      <StudioSettingsRow label="Estado neste quadro" value={<span className="text-muted-foreground">Rascunho no Clickora — ainda não publicado na conta Google.</span>} />
                      <StudioSettingsRow
                        label="Nome da campanha"
                        value={
                          <Input
                            id="manual-campaign-name"
                            className="h-9 max-w-lg"
                            value={f.campaignName}
                            maxLength={250}
                            onChange={(e) => onManualFormChange((p) => ({ ...p, campaignName: e.target.value }))}
                            placeholder="Ex.: Marca · Pesquisa · Mercado — Conversões"
                          />
                        }
                      />
                      <StudioSettingsRow
                        label="Resumo interno"
                        value={
                          <Textarea
                            id="manual-objective-summary"
                            rows={2}
                            className="max-w-lg resize-y text-sm"
                            maxLength={500}
                            value={f.objectiveSummary}
                            onChange={(e) => onManualFormChange((p) => ({ ...p, objectiveSummary: e.target.value }))}
                            placeholder="Notas de objectivo registadas ao nível da campanha (não copiadas verbatim para os anúncios)."
                          />
                        }
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>

              <section id="manual-sec-redes" className="scroll-mt-28">
                <Collapsible defaultOpen className="group/r">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30">
                    <span>Redes</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/r:rotate-180" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-b border-border/40 bg-background/70">
                      <StudioSettingsRow label="Tipo" value={<span className="font-medium">Rede de Pesquisa Google</span>} />
                      <StudioSettingsRow
                        label="Parceiros de pesquisa"
                        value={
                          <span className="text-muted-foreground">
                            Alinhável na publicação com a política de pesquisa padrão; detalhes de parceiros em{" "}
                            <span className="font-medium text-foreground">Gestão</span>
                            ou na conta Google quando activo para a campanha.
                          </span>
                        }
                        subdued
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>

              <section id="manual-sec-orcamento" className="scroll-mt-28">
                <Collapsible defaultOpen className="group/o">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 border-b border-border/60 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30">
                    <span>Orçamento e lances (síntese)</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/o:rotate-180" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-b border-border/40 px-4 py-4 text-[12px] leading-relaxed text-muted-foreground">
                      <p>
                        Mantém o mesmo bloco conceptual que «Otimização de orçamentos e lances» na Google Ads: valores
                        abaixo vêm dos passos <strong className="text-foreground">Orçamento e licitação</strong> e{" "}
                        <strong className="text-foreground">Localização</strong> neste assistente — podem mudar volta a esse
                        passo para afinar antes de criar.
                      </p>
                      <Separator className="my-4" />
                      <div className="rounded-lg border border-border/60 divide-y divide-border/60 bg-muted/15">
                        <StudioSettingsRow
                          label="Orçamento diário (USD)"
                          value={
                            wc?.dailyBudgetUsd?.trim()
                              ? (
                                  <>
                                    <span className="rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[13px] font-medium">
                                      {wc.dailyBudgetUsd.trim()} USD por dia
                                    </span>
                                    <span className="mt-1 block text-[11px] text-muted-foreground">Editar no passo Orçamento e licitação.</span>
                                  </>
                                )
                              : <span className="italic">Define no passo «Orçamento e licitação».</span>
                          }
                        />
                        <StudioSettingsRow
                          label="Estratégia de licitação (Google)"
                          value={
                            wc?.biddingStrategyLabel ? (
                              <span className="rounded-md bg-muted/80 px-2 py-0.5">{wc.biddingStrategyLabel}</span>
                            ) : (
                              <span className="italic">Escolha no passo correspondente ao orçamento.</span>
                            )
                          }
                        />
                        <StudioSettingsRow
                          label="Localizações (mercados)"
                          value={
                            wc?.geoSummary?.trim()
                              ? <span className="font-mono text-xs">{wc.geoSummary}</span>
                              : <span className="italic">Defina mercados ISO no passo Geo.</span>
                          }
                        />
                        <StudioSettingsRow
                          label="Idiomas dos anúncios"
                          value={
                            wc?.languageSummary?.trim()
                              ? <span className="font-mono text-xs">{wc.languageSummary}</span>
                              : <span className="italic">Defina no passo Localização.</span>
                          }
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>

              <section id="manual-sec-publico-grupos" className="scroll-mt-28">
                <Collapsible defaultOpen className="group/p">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/30">
                    <span>Público · palavras‑chave · anúncios RSA</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/p:rotate-180" aria-hidden />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-5 border-t border-border/60 bg-muted/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grupos (máx. 5)</p>
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => void addAg()}>
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Novo grupo
                        </Button>
                      </div>

                      {f.adGroups.map((ag, gi) => {
                        const headlineCount = rsaLines(ag.headlinesText, 15).length;
                        const descCount = rsaLines(ag.descriptionsText, 4).length;
                        const kwCount = parseGoogleManualKeywordLines(ag.keywordsText).length;
                        return (
                          <div key={ag.id} className="rounded-lg border border-border/70 bg-background/90 p-3 shadow-xs">
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                              <div className="grid min-w-0 flex-1 gap-2">
                                <Label htmlFor={`ag-name-${ag.id}`} className="text-[11px]">
                                  Grupo {gi + 1} · nome
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
                                className="mt-6 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                                disabled={f.adGroups.length <= 1}
                                onClick={() => removeAg(ag.id)}
                                aria-label="Remover grupo"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>

                            <Separator className="my-4 opacity-50" />

                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <Label htmlFor={`ag-kw-${ag.id}`} className="text-[11px]">
                                  Palavras‑chave ({kwCount}) — uma linha cada. Prefixos{" "}
                                  <code className="text-[10px]">exact </code>
                                  <code className="text-[10px]">phrase </code>
                                  <code className="text-[10px]">broad </code>
                                  (omissão → broad).
                                </Label>
                                <Textarea
                                  id={`ag-kw-${ag.id}`}
                                  rows={5}
                                  className="font-mono text-xs"
                                  placeholder={"exact marca exemplo\nphrase comprar online\nproduto"}
                                  value={ag.keywordsText}
                                  onChange={(e) => updateAg(ag.id, { keywordsText: e.target.value })}
                                />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label htmlFor={`ag-h-${ag.id}`} className="text-[11px]">
                                    Titulares RSA ({headlineCount}/15, máx. 30 caracteres na rede)
                                  </Label>
                                  <Textarea
                                    id={`ag-h-${ag.id}`}
                                    rows={7}
                                    className="font-mono text-xs"
                                    placeholder="Um titular por linha"
                                    value={ag.headlinesText}
                                    onChange={(e) => updateAg(ag.id, { headlinesText: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label htmlFor={`ag-d-${ag.id}`} className="text-[11px]">
                                    Descrições RSA ({descCount}/4, máx. 90 caracteres)
                                  </Label>
                                  <Textarea
                                    id={`ag-d-${ag.id}`}
                                    rows={7}
                                    className="font-mono text-xs"
                                    placeholder="Uma linha por descrição"
                                    value={ag.descriptionsText}
                                    onChange={(e) => updateAg(ag.id, { descriptionsText: e.target.value })}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[10px] leading-relaxed text-muted-foreground">
                        Antes de «Gerar plano», o servidor aplica os limites de caracteres Google (titulares 30 /
                        descrições 90). O mínimo de linhas RSA e extensões obedece às mesmas regras que no modo assistido.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </section>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
