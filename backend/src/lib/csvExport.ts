import type { Response } from "express";

/** RFC 4180-style escaping; UTF-8 BOM prefix helps Excel open accents correctly. */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const SAFE_FILENAME = /^[a-zA-Z0-9._\-]+$/;

export function sanitizeCsvFilename(name: string, fallback: string): string {
  const base = name.trim() || fallback;
  if (SAFE_FILENAME.test(base) && base.length <= 200) return base;
  return fallback;
}

export function sendCsvDownload(
  res: Response,
  filename: string,
  headers: string[],
  rows: unknown[][],
  opts?: { nextCursor?: string | null },
): void {
  const safeName = sanitizeCsvFilename(filename, "export.csv");
  const bom = "\uFEFF";
  const headerLine = headers.map(csvEscape).join(",");
  const bodyLines = rows.map((r) => r.map(csvEscape).join(","));
  const payload = bom + [headerLine, ...bodyLines].join("\r\n") + "\r\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  if (opts?.nextCursor) {
    res.setHeader("X-Next-Cursor", opts.nextCursor);
  }
  res.send(payload);
}
