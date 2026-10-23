/**
 * Export CSV das linhas já filtradas no ecrã (Situação / pesquisa) —
 * alinhado com o que o buyer vê, sem segundo round-trip.
 */
export function reportRowsToCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [columns.map((c) => esc(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => esc(row[c.key])).join(","));
  }
  return lines.join("\n");
}

export function downloadTextCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
