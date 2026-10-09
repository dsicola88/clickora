const DOUBLE_WIDTH =
  /[\u1100-\u115F\u2329\u232A\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/u;

export function adTextLength(value: string): number {
  let n = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    n += DOUBLE_WIDTH.test(ch) || cp > 0xffff ? 2 : 1;
  }
  return n;
}

export function finalExportBlockReason(issues: Array<{ level: string }>): string | null {
  const invalid = issues.filter((item) => item.level === "invalid").length;
  if (!invalid) return null;
  return `Exportação final bloqueada: ${invalid} elemento(s) inválido(s). O rascunho pode ser gravado.`;
}

export function adsToCsv(rows: Array<{ kind: string; text: string; pin: string; url: string; platform: string }>): string {
  const header = "kind,text,pin,url,platform";
  const esc = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const body = rows.map((r) => [r.kind, r.text, r.pin, r.url, r.platform].map(esc).join(","));
  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}
