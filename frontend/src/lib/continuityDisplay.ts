import type { ContinuityOverviewDto } from "@/types/api";

/** Uptime chega como rácio 0–1 (ou null sem dados) — mostra com 2 casas quando abaixo de 100%. */
export function formatUptime(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  if (pct >= 99.995) return "100%";
  return `${pct.toFixed(2)}%`;
}

export function uptimeTone(ratio: number | null | undefined): "good" | "warn" | "bad" | "none" {
  if (ratio == null || !Number.isFinite(ratio)) return "none";
  if (ratio >= 0.999) return "good";
  if (ratio >= 0.98) return "warn";
  return "bad";
}

const RISK_ORDER: Record<string, number> = { no_domain: 0, primary_down: 1, primary_paused: 2, on_backup: 3 };

export function presellsAtRisk(presells: ContinuityOverviewDto["presells"]): ContinuityOverviewDto["presells"] {
  return presells
    .filter((p) => p.risk !== "ok")
    .sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9));
}

/** Link "Abrir Google Ads": só navegação para a UI oficial, nunca mutação via API. */
export const GOOGLE_ADS_UI_URL = "https://ads.google.com/aw/ads";
