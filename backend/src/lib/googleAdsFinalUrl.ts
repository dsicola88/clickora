/**
 * Regras de Final URL Google Ads (afiliado): lander limpa, sem click IDs manuais nem ValueTrack.
 * Espelha a intenção de `sanitizeLandingUrlForAdsFinal` no frontend.
 */

export type FinalUrlIssueCode =
  | "empty_final_url"
  | "not_https"
  | "invalid_url"
  | "final_url_has_click_id"
  | "final_url_has_valuetrack"
  | "host_mismatch";

const CLICK_ID_KEYS = new Set(["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "ttclid"]);

export function hostFromUrl(raw: string | null | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function issueLabelPt(code: FinalUrlIssueCode): string {
  switch (code) {
    case "empty_final_url":
      return "Final URL vazia";
    case "not_https":
      return "Final URL sem HTTPS";
    case "invalid_url":
      return "Final URL inválida";
    case "final_url_has_click_id":
      return "Final URL com gclid/gbraid/wbraid (use auto-tagging)";
    case "final_url_has_valuetrack":
      return "Final URL com ValueTrack {…} (vá para sufixo/template)";
    case "host_mismatch":
      return "Host diferente do website do projecto";
    default:
      return code;
  }
}

/** Inspecciona uma Final URL; `expectedHost` sem www (opcional). */
export function inspectFinalUrl(raw: string, expectedHost?: string | null): FinalUrlIssueCode[] {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return ["empty_final_url"];

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return ["invalid_url"];
  }

  const issues: FinalUrlIssueCode[] = [];
  if (u.protocol !== "https:") {
    if (u.protocol === "http:") issues.push("not_https");
    else {
      issues.push("invalid_url");
      return issues;
    }
  }

  for (const key of u.searchParams.keys()) {
    const lk = key.toLowerCase();
    const v = u.searchParams.get(key) ?? "";
    if (CLICK_ID_KEYS.has(lk)) issues.push("final_url_has_click_id");
    if (/\{[a-z0-9_.]+\}/i.test(v) || /\{[a-z0-9_.]+\}/i.test(key)) {
      issues.push("final_url_has_valuetrack");
    }
  }
  // ValueTrack no path (raro mas válido de flag)
  if (/\{[a-z0-9_.]+\}/i.test(u.pathname + u.search)) {
    if (!issues.includes("final_url_has_valuetrack")) issues.push("final_url_has_valuetrack");
  }

  const exp = expectedHost?.trim().toLowerCase().replace(/^www\./, "") || null;
  if (exp) {
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host && host !== exp) issues.push("host_mismatch");
  }

  return [...new Set(issues)];
}

export function inspectFinalUrlList(
  urls: string[],
  expectedHost?: string | null,
): {
  issues: FinalUrlIssueCode[];
  hosts: string[];
  sample_url: string | null;
  multiple_distinct_hosts: boolean;
} {
  const list = urls.map((u) => String(u ?? "").trim()).filter(Boolean);
  if (list.length === 0) {
    return {
      issues: ["empty_final_url"],
      hosts: [],
      sample_url: null,
      multiple_distinct_hosts: false,
    };
  }
  const issues = new Set<FinalUrlIssueCode>();
  const hosts = new Set<string>();
  for (const url of list) {
    for (const code of inspectFinalUrl(url, expectedHost)) issues.add(code);
    const h = hostFromUrl(url);
    if (h) hosts.add(h);
  }
  return {
    issues: [...issues],
    hosts: [...hosts],
    sample_url: list[0] ?? null,
    multiple_distinct_hosts: hosts.size > 1,
  };
}
