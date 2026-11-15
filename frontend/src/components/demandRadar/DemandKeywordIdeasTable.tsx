import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppLocale } from "@/i18n/AppLocaleProvider";
import type { MessageKey } from "@/i18n";
import type { DemandPlannerIdea } from "@/services/demandRadarService";
import { cn } from "@/lib/utils";

type SortKey = "keyword" | "volume" | "change3m" | "yoy" | "competition" | "bidLow" | "bidHigh";
type CompFilter = "all" | "low" | "medium" | "high";
type WordsFilter = "all" | "1" | "2" | "3plus";

function formatInt(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

function formatMoney(n: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPct(n: number | null | undefined, empty: string) {
  if (n == null || !Number.isFinite(n)) return empty;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function competitionLabel(c: DemandPlannerIdea["competition"], t: (k: MessageKey) => string) {
  if (c === "low") return t("pages.demandRadar.competitionLow");
  if (c === "high") return t("pages.demandRadar.competitionHigh");
  return t("pages.demandRadar.competitionMedium");
}

function competitionRank(c: DemandPlannerIdea["competition"]) {
  if (c === "low") return 1;
  if (c === "medium") return 2;
  return 3;
}

function wordCount(keyword: string) {
  return keyword.trim().split(/\s+/).filter(Boolean).length;
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap rounded-md border border-border/70 bg-muted/30 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-[5px] px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
            value === opt.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
  return dir === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

function ChangeCell({ value, empty }: { value: number | null | undefined; empty: string }) {
  const text = formatPct(value, empty);
  if (value == null) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        value > 0 && "text-emerald-700 dark:text-emerald-400",
        value < 0 && "text-rose-700 dark:text-rose-400",
      )}
    >
      {text}
    </span>
  );
}

export function DemandKeywordIdeasTable({
  ideas,
  primaryKeyword,
  primaryKindLabel,
  plannerOk,
  busy,
  onAnalyze,
}: {
  ideas: DemandPlannerIdea[];
  primaryKeyword?: string | null;
  primaryKindLabel?: string | null;
  plannerOk: boolean;
  busy?: boolean;
  onAnalyze: (keyword: string) => void;
}) {
  const { t, locale } = useAppLocale();
  const nl =
    locale === "pt-BR" ? "pt-BR" : locale === "pt" ? "pt-PT" : locale === "es" ? "es-ES" : "en-US";
  const empty = t("pages.demandRadar.noVolume");

  const [query, setQuery] = useState("");
  const [comp, setComp] = useState<CompFilter>("all");
  const [words, setWords] = useState<WordsFilter>("all");
  const [minVol, setMinVol] = useState<"0" | "100" | "1000" | "10000">("0");
  const [sortKey, setSortKey] = useState<SortKey>("volume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [refineOpen, setRefineOpen] = useState(true);

  const maxVol = useMemo(
    () => ideas.reduce((m, i) => Math.max(m, i.monthly_volume), 0),
    [ideas],
  );

  const provided = useMemo(() => {
    if (!primaryKeyword) return [] as DemandPlannerIdea[];
    const p = primaryKeyword.trim().toLowerCase();
    return ideas.filter((i) => i.keyword.trim().toLowerCase() === p);
  }, [ideas, primaryKeyword]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = Number(minVol);
    const primary = primaryKeyword?.trim().toLowerCase() ?? "";
    let rows = ideas.filter((idea) => {
      if (primary && idea.keyword.trim().toLowerCase() === primary) return false;
      if (q && !idea.keyword.toLowerCase().includes(q)) return false;
      if (comp !== "all" && idea.competition !== comp) return false;
      if (idea.monthly_volume < min) return false;
      const wc = wordCount(idea.keyword);
      if (words === "1" && wc !== 1) return false;
      if (words === "2" && wc !== 2) return false;
      if (words === "3plus" && wc < 3) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "keyword") cmp = a.keyword.localeCompare(b.keyword);
      else if (sortKey === "volume") cmp = a.monthly_volume - b.monthly_volume;
      else if (sortKey === "change3m") cmp = (a.change_3m_pct ?? -9999) - (b.change_3m_pct ?? -9999);
      else if (sortKey === "yoy") cmp = (a.change_yoy_pct ?? -9999) - (b.change_yoy_pct ?? -9999);
      else if (sortKey === "bidLow") cmp = (a.bid_low ?? -1) - (b.bid_low ?? -1);
      else if (sortKey === "bidHigh") cmp = (a.bid_high ?? -1) - (b.bid_high ?? -1);
      else cmp = competitionRank(a.competition) - competitionRank(b.competition);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [ideas, query, comp, words, minVol, sortKey, sortDir, primaryKeyword]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "keyword" ? "asc" : "desc");
    }
  }

  function renderRows(rows: DemandPlannerIdea[], section?: string) {
    return rows.map((idea) => {
      const isPrimary =
        primaryKeyword &&
        idea.keyword.trim().toLowerCase() === primaryKeyword.trim().toLowerCase();
      const bar = maxVol > 0 ? Math.max(4, Math.round((idea.monthly_volume / maxVol) * 100)) : 0;
      return (
        <tr key={`${section ?? "x"}-${idea.keyword}`} className={cn("border-t border-border/50", isPrimary && "bg-sky-500/5")}>
          <td className="px-4 py-2.5 font-medium">
            <div className="flex flex-wrap items-center gap-2">
              <span>{idea.keyword}</span>
              {isPrimary && primaryKindLabel ? (
                <span className="text-[10px] font-semibold uppercase text-sky-700 dark:text-sky-300">
                  {primaryKindLabel}
                </span>
              ) : null}
            </div>
          </td>
          <td className="px-4 py-2.5">
            <div className="flex min-w-[8.5rem] items-center gap-2">
              <span className="w-14 tabular-nums">{formatInt(idea.monthly_volume, nl)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-sky-500/70" style={{ width: `${bar}%` }} />
              </div>
            </div>
          </td>
          <td className="px-4 py-2.5">
            <ChangeCell value={idea.change_3m_pct} empty={empty} />
          </td>
          <td className="px-4 py-2.5">
            <ChangeCell value={idea.change_yoy_pct} empty={empty} />
          </td>
          <td className="px-4 py-2.5">
            <span
              className={cn(
                "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                idea.competition === "low" && "bg-emerald-500/10 text-emerald-700",
                idea.competition === "medium" && "bg-amber-500/10 text-amber-700",
                idea.competition === "high" && "bg-rose-500/10 text-rose-700",
              )}
            >
              {competitionLabel(idea.competition, t)}
            </span>
            {idea.competition_index != null ? (
              <span className="ml-1.5 tabular-nums text-[11px] text-muted-foreground">
                {idea.competition_index}
              </span>
            ) : null}
          </td>
          <td className="px-4 py-2.5 tabular-nums">
            {idea.bid_low != null ? formatMoney(idea.bid_low, nl) : empty}
          </td>
          <td className="px-4 py-2.5 tabular-nums">
            {idea.bid_high != null ? formatMoney(idea.bid_high, nl) : empty}
          </td>
          <td className="px-4 py-2.5 text-right">
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAnalyze(idea.keyword)}>
              {t("pages.demandRadar.useKeyword")}
            </Button>
          </td>
        </tr>
      );
    });
  }

  if (ideas.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <h3 className="text-sm font-semibold">{t("pages.demandRadar.ideasTitle")}</h3>
        </div>
        <p className="px-4 py-6 text-sm text-muted-foreground">{t("pages.demandRadar.ideasEmpty")}</p>
      </div>
    );
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "keyword", label: t("pages.demandRadar.thKeyword") },
    { key: "volume", label: t("pages.demandRadar.thVolume") },
    { key: "change3m", label: t("pages.demandRadar.thChange3m") },
    { key: "yoy", label: t("pages.demandRadar.thChangeYoy") },
    { key: "competition", label: t("pages.demandRadar.thCompetition") },
    { key: "bidLow", label: t("pages.demandRadar.thBidLow") },
    { key: "bidHigh", label: t("pages.demandRadar.thBidHigh") },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{t("pages.demandRadar.ideasTitle")}</h3>
          <p className="text-[11px] text-muted-foreground">
            {ideas.length} {t("pages.demandRadar.ideasAvailable")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              plannerOk
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {plannerOk ? t("pages.demandRadar.sourceGoogle") : t("pages.demandRadar.sourceUnavailable")}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => setRefineOpen((v) => !v)}>
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            {t("pages.demandRadar.refineKeywords")}
          </Button>
        </div>
      </div>

      <div className={cn("grid gap-0", refineOpen && "lg:grid-cols-[220px_1fr]")}>
        {refineOpen ? (
          <aside className="space-y-4 border-b border-border/60 bg-muted/15 p-4 lg:border-b-0 lg:border-r">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("pages.demandRadar.refineTitle")}
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("pages.demandRadar.ideasSearchPlaceholder")}
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("pages.demandRadar.thCompetition")}
              </p>
              <Segmented
                value={comp}
                onChange={(v) => setComp(v as CompFilter)}
                options={[
                  { id: "all", label: t("pages.demandRadar.filterCompAll") },
                  { id: "low", label: t("pages.demandRadar.competitionLow") },
                  { id: "medium", label: t("pages.demandRadar.competitionMedium") },
                  { id: "high", label: t("pages.demandRadar.competitionHigh") },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("pages.demandRadar.filterWordsAll")}
              </p>
              <Segmented
                value={words}
                onChange={(v) => setWords(v as WordsFilter)}
                options={[
                  { id: "all", label: t("pages.demandRadar.filterWordsAll") },
                  { id: "1", label: t("pages.demandRadar.filterWords1") },
                  { id: "2", label: t("pages.demandRadar.filterWords2") },
                  { id: "3plus", label: t("pages.demandRadar.filterWords3") },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("pages.demandRadar.thVolume")}
              </p>
              <Segmented
                value={minVol}
                onChange={(v) => setMinVol(v as typeof minVol)}
                options={[
                  { id: "0", label: t("pages.demandRadar.filterVolAll") },
                  { id: "100", label: "100+" },
                  { id: "1000", label: "1k+" },
                  { id: "10000", label: "10k+" },
                ]}
              />
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {t("pages.demandRadar.refineNote")}
            </p>
          </aside>
        ) : null}

        <div className="min-w-0">
          {filtered.length === 0 && provided.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("pages.demandRadar.ideasFilterEmpty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className="px-4 py-2.5 font-semibold">
                        <button
                          type="button"
                          className="inline-flex items-center hover:text-foreground"
                          onClick={() => toggleSort(col.key)}
                        >
                          {col.label}
                          <SortIcon active={sortKey === col.key} dir={sortDir} />
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {provided.length > 0 ? (
                    <>
                      <tr className="bg-muted/20">
                        <td colSpan={8} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("pages.demandRadar.sectionProvided")}
                        </td>
                      </tr>
                      {renderRows(provided, "provided")}
                      <tr className="bg-muted/20">
                        <td colSpan={8} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("pages.demandRadar.sectionIdeas")} · {filtered.length}
                        </td>
                      </tr>
                    </>
                  ) : null}
                  {renderRows(filtered, "ideas")}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
