import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CreativePanels } from "@/components/adsGen/CreativePanels";
import { cn } from "@/lib/utils";
import { magazineCopyText } from "@/lib/magazineCopyText";
import { adTextLength } from "@/lib/adText";
import {
  filterKeywords,
  formatResearchDate,
  groupNegativeKeywords,
  KEYWORD_FUNNEL_SECTIONS,
  KEYWORD_INTENT_FILTERS,
  keywordFunnel,
  negativeGroupLabel,
  setKeywordSelection,
  toggleKeywordSelection,
} from "@/lib/keywordResults";
import type { AdBundle, KeywordIntent, KeywordItem, KeywordResearch, ValidationIssue } from "@/services/keywordResearchService";

export type MagazineTab = "copy" | "keywords" | "negatives" | "adjust";

const TABS: { id: MagazineTab; label: string }[] = [
  { id: "copy", label: "Copy vencedora" },
  { id: "keywords", label: "Palavras-chave" },
  { id: "negatives", label: "Negativas" },
  { id: "adjust", label: "Ajustes Google" },
];

async function copyText(text: string, ok: string) {
  await navigator.clipboard.writeText(text);
  toast.success(ok);
}

function CopySection({
  title,
  hint,
  lines,
  charMax,
  emptyLabel = "Nada nesta secção — confirme dados na página ou edite em Ajustes Google.",
}: {
  title: string;
  hint?: string;
  lines: string[];
  charMax?: number;
  emptyLabel?: string;
}) {
  const hasLines = lines.some((l) => l.trim());
  return (
    <section className="rounded-xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h3>
          {hint ? <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{hint}</p> : null}
        </div>
        {hasLines ? (
          <Button type="button" size="sm" variant="secondary" className="h-8" onClick={() => void copyText(lines.join("\n"), "Secção copiada")}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copiar todos
          </Button>
        ) : null}
      </div>
      <div className="px-4 py-3">
        {!hasLines ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-0.5">
            {lines.map((line, i) => (
              <li key={`${title}-${i}`} className="group flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50">
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground pt-0.5">{i + 1}.</span>
                <span className="min-w-0 flex-1 text-sm leading-relaxed">{line}</span>
                {charMax ? (
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tabular-nums pt-0.5",
                      adTextLength(line) > charMax ? "text-destructive font-medium" : "text-muted-foreground",
                    )}
                  >
                    {adTextLength(line)}/{charMax}
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 opacity-60 group-hover:opacity-100"
                  onClick={() => void copyText(line, "Copiado")}
                >
                  Copiar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AdjustPanels({
  bundle,
  issues,
  onChange,
}: {
  bundle: AdBundle;
  issues: ValidationIssue[];
  onChange: (next: AdBundle) => void;
}) {
  const [sub, setSub] = useState<"ad" | "assets" | "review">("ad");
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Só use se precisar corrigir caracteres, URLs dos sitelinks ou rever alertas antes de exportar CSV.
      </p>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["ad", "RSA"],
            ["assets", "Extensões"],
            ["review", "Validação"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} type="button" size="sm" variant={sub === id ? "default" : "outline"} className="h-8" onClick={() => setSub(id)}>
            {label}
          </Button>
        ))}
      </div>
      <CreativePanels tab={sub} bundle={bundle} issues={issues} onChange={onChange} />
    </div>
  );
}

function StatusStrip({ bundle, issues }: { bundle: AdBundle; issues: ValidationIssue[] }) {
  const invalid = issues.filter((i) => i.level === "invalid").length;
  const overHeadline = bundle.headlines.some((h) => adTextLength(h.text) > 30);
  const overDesc = bundle.descriptions.some((d) => adTextLength(d.text) > 90);
  return (
    <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
      {bundle.headlines.length} títulos · {bundle.descriptions.length} descrições · {bundle.sitelinks.length} sitelinks ·{" "}
      {bundle.callouts.length} destaques
      {bundle.callouts.length === 1 ? (
        <span className="text-amber-700 dark:text-amber-400"> · Adicione mais 1 destaque (25 car.) para o Google servir</span>
      ) : null}
      {invalid || overHeadline || overDesc ? (
        <span className="text-amber-700 dark:text-amber-400"> · Revise limites em Ajustes Google</span>
      ) : (
        <span className="text-emerald-700 dark:text-emerald-400"> · Pronto para copiar para a conta Google</span>
      )}
    </p>
  );
}

function SimpleKeywordTable({
  rows,
  selected,
  onToggle,
  onEdit,
}: {
  rows: KeywordItem[];
  selected: Set<string>;
  onToggle: (keyword: string) => void;
  onEdit: (from: string, to: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((item, index) => (
            <tr key={`${item.intent}-${index}`} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
              <td className="w-9 px-2 py-2 align-middle">
                <Checkbox
                  checked={selected.has(item.keyword)}
                  onCheckedChange={() => onToggle(item.keyword)}
                  aria-label={`Seleccionar ${item.keyword}`}
                />
              </td>
              <td className="py-2 pr-2">
                <Input
                  aria-label={`Palavra-chave ${item.keyword}`}
                  value={item.keyword}
                  className="h-8 border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background"
                  onChange={(e) => onEdit(item.keyword, e.target.value)}
                />
              </td>
              <td className="w-24 py-2 pr-3 text-right">
                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => void copyText(item.keyword, "Copiada")}>
                  Copiar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CampaignMagazineStudio({
  research,
  tab,
  onTabChange,
  bundle,
  issues,
  onBundleChange,
  query,
  onQueryChange,
  intent,
  onIntentChange,
  selected,
  onSelectedChange,
  onEditKeyword,
  onCopyKeywords,
  onCopySelected,
  onExportKeywordsCsv,
}: {
  research: KeywordResearch;
  tab: MagazineTab;
  onTabChange: (tab: MagazineTab) => void;
  bundle: AdBundle;
  issues: ValidationIssue[];
  onBundleChange: (next: AdBundle) => void;
  query: string;
  onQueryChange: (q: string) => void;
  intent: "ALL" | KeywordIntent;
  onIntentChange: (intent: "ALL" | KeywordIntent) => void;
  selected: Set<string>;
  onSelectedChange: (updater: (prev: Set<string>) => Set<string>) => void;
  onEditKeyword: (from: string, to: string) => void;
  onCopyKeywords: () => void;
  onCopySelected: () => void;
  onExportKeywordsCsv: () => void;
}) {
  const analysis = bundle.analysis;
  const funnelName = analysis?.funnel === "MIDDLE" ? "Meio de funil" : analysis?.funnel === "TOP" ? "Topo de funil" : "Fundo de funil";

  const sitelinkLines = bundle.sitelinks.flatMap((s) => {
    const block = [s.text, s.description1, s.description2].filter(Boolean);
    return block.length ? [block.join(" · ")] : [];
  });

  const snippetLines = bundle.snippet ? bundle.snippet.values : [];
  const promoLines = bundle.promotion ? [`${bundle.promotion.value} — ${bundle.promotion.item}`] : [];

  const visible = filterKeywords(research.keywords, query, intent).filter((k) => k.intent !== "NEGATIVE");
  const selectedItems = research.keywords.filter((k) => selected.has(k.keyword));

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{research.product}</h2>
          <Button
            type="button"
            size="sm"
            className="h-9"
            onClick={() => void copyText(magazineCopyText(research.product, bundle, research.keywords), "Copy completa (estilo PDF)")}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copiar pacote completo
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {analysis?.affiliatePlatformLabel ?? "Campanha"} · {funnelName} · {research.language_label} · {research.market_name}
          {research.updated_at ? ` · ${formatResearchDate(research.updated_at)}` : ""}
        </p>
        <StatusStrip bundle={bundle} issues={issues} />
      </header>

      <div className="flex flex-wrap gap-1 border-b border-border/60 pb-1" role="tablist">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
            onClick={() => onTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "copy" ? (
        <div className="space-y-4 max-w-3xl">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Mesma lógica do material MAG: copie título a título para o Google Ads. Use IA para variar frases sem perder o sentido.
          </p>
          <CopySection
            title="Títulos"
            hint="Máximo 30 caracteres por título (contagem Google)."
            charMax={30}
            lines={bundle.headlines.map((h) => h.text)}
          />
          <CopySection
            title="Descrições"
            hint="Máximo 90 caracteres por descrição."
            charMax={90}
            lines={bundle.descriptions.map((d) => d.text)}
          />
          <CopySection
            title="Frase de destaque"
            hint="Até 25 caracteres · mínimo 2 para servir."
            charMax={25}
            lines={bundle.callouts.map((c) => c.text)}
          />
          <CopySection
            title="Snippet estruturado"
            lines={snippetLines}
            emptyLabel="Omitido até haver lista real na página (tipos, marcas, serviços)."
          />
          <CopySection title="Sitelink" hint="Texto + descrições · URL definida na presell." lines={sitelinkLines} />
          <CopySection title="Promoção" lines={promoLines} emptyLabel="Omitida sem desconto confirmado na página." />
          {analysis?.facts?.length ? (
            <details className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium">Factos lidos na página (preço, garantia, CTA)</summary>
              <ul className="mt-3 space-y-2">
                {analysis.facts.map((fact) => (
                  <li key={`${fact.label}-${fact.value}`} className="flex justify-between gap-2">
                    <span>
                      <span className="text-xs uppercase text-muted-foreground">{fact.label}: </span>
                      {fact.value}
                    </span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0" onClick={() => void copyText(fact.value, "Copiado")}>
                      Copiar
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {tab === "keywords" ? (
        <div className="space-y-3 max-w-3xl">
          <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Filtrar palavras-chave…" className="max-w-md" />
          <div className="flex flex-wrap gap-1.5">
            {KEYWORD_INTENT_FILTERS.filter((f) => f.id !== "NEGATIVE").map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={intent === f.id ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => onIntentChange(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={onCopyKeywords}>
              Copiar todas
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!selectedItems.length} onClick={onCopySelected}>
              Copiar seleccionadas ({selected.size})
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onExportKeywordsCsv}>
              Exportar CSV
            </Button>
          </div>
          {KEYWORD_FUNNEL_SECTIONS.map((section) => {
            const rows = visible.filter((k) => keywordFunnel(k) === section.id);
            if (!rows.length) return null;
            return (
              <div key={section.id} className="space-y-2">
                <h3 className="text-sm font-semibold">{section.title}</h3>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
                <SimpleKeywordTable
                  rows={rows}
                  selected={selected}
                  onToggle={(kw) => onSelectedChange((s) => toggleKeywordSelection(s, kw))}
                  onEdit={onEditKeyword}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "negatives" ? (
        <div className="space-y-3 max-w-3xl">
          <p className="text-sm text-muted-foreground">Revise antes de aplicar — uma negativa errada corta compradores.</p>
          <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Filtrar negativas…" className="max-w-md" />
          {groupNegativeKeywords(
            research.keywords.filter(
              (k) => k.intent === "NEGATIVE" && (!query.trim() || k.keyword.toLowerCase().includes(query.trim().toLowerCase())),
            ),
          ).map((group) => {
            const keys = group.items.map((k) => k.keyword);
            const allOn = keys.every((k) => selected.has(k));
            return (
              <div key={group.group} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{negativeGroupLabel(group.group)}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onSelectedChange((s) => setKeywordSelection(s, keys, !allOn))}
                  >
                    {allOn ? "Desmarcar" : "Seleccionar grupo"}
                  </Button>
                </div>
                <SimpleKeywordTable
                  rows={group.items}
                  selected={selected}
                  onToggle={(kw) => onSelectedChange((s) => toggleKeywordSelection(s, kw))}
                  onEdit={onEditKeyword}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === "adjust" ? (
        <AdjustPanels bundle={bundle} issues={issues} onChange={onBundleChange} />
      ) : null}
    </div>
  );
}
