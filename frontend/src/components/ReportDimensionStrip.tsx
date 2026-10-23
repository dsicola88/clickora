import { cn } from "@/lib/utils";

type Row = {
  device?: string;
  country?: string;
  origin?: string;
  type?: string;
  status?: string;
  statusKind?: string;
};

type Props = {
  rows: Row[];
  className?: string;
};

function topCounts(values: string[], n = 4): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const v = (raw || "—").trim() || "—";
    if (v === "—") continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

function situationTotals(rows: Row[]): { label: string; count: number }[] {
  let real = 0;
  let bot = 0;
  let datacenter = 0;
  for (const r of rows) {
    const k = (r.statusKind || "").toLowerCase();
    if (k === "bot") bot += 1;
    else if (k === "datacenter") datacenter += 1;
    else if (k === "real" || r.status) real += 1;
    else real += 1;
  }
  return [
    { label: "Real", count: real },
    { label: "Bot", count: bot },
    { label: "Cloud / servidor", count: datacenter },
  ].filter((x) => x.count > 0);
}

/**
 * Dimensões buyer enterprise: dispositivo / país / tipo / Situação (sem query extra).
 */
export function ReportDimensionStrip({ rows, className }: Props) {
  if (!rows.length) return null;
  const devices = topCounts(rows.map((r) => r.device || ""));
  const countries = topCounts(rows.map((r) => r.country || ""));
  const types = topCounts(rows.map((r) => r.type || ""));
  const situations = situationTotals(rows);

  const block = (title: string, items: { label: string; count: number }[]) => (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{title}</p>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((i) => (
            <li key={`${title}-${i.label}`} className="flex justify-between gap-2 text-[11px] tabular-nums">
              <span className="truncate text-foreground/90" title={i.label}>
                {i.label}
              </span>
              <span className="text-muted-foreground shrink-0">{i.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-4 rounded-xl border border-border/60 bg-muted/15 px-4 py-3",
        className,
      )}
    >
      {block("Situação", situations)}
      {block("Dispositivo", devices)}
      {block("País", countries)}
      {block("Tipo (anúncio)", types)}
    </div>
  );
}
