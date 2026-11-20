/**
 * Preferências partilhadas do Campaign Manager (período + filtro de campanha).
 * Persistidas por projecto no localStorage para não resetar ao mudar de página.
 */
import type { MessageKey } from "@/i18n";

export const GOOGLE_MANAGER_ALL_CAMPAIGNS = "__all__";

/** Presets aceites pela API Google Ads do Ads Studio. */
export const GOOGLE_MANAGER_PRESETS = [
  "today",
  "yesterday",
  "last_7",
  "last_30",
  "this_month",
  "last_month",
] as const;

export type GoogleManagerPreset = (typeof GOOGLE_MANAGER_PRESETS)[number];

export type GoogleManagerPrefs = {
  preset: GoogleManagerPreset;
  campaignFilter: string;
};

const DEFAULT: GoogleManagerPrefs = {
  preset: "today",
  campaignFilter: GOOGLE_MANAGER_ALL_CAMPAIGNS,
};

const PRESET_SET = new Set<string>(GOOGLE_MANAGER_PRESETS);

/** Fallback PT-PT (testes / callers sem `t`). Preferir `googleManagerPresetLabelKey` + i18n. */
const PRESET_LABELS: Record<GoogleManagerPreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last_7: "Últimos 7 dias",
  last_30: "Últimos 30 dias",
  this_month: "Este mês",
  last_month: "Mês anterior",
};

const PRESET_I18N_KEYS: Record<GoogleManagerPreset, MessageKey> = {
  today: "pages.dpilot.google.cm.presetToday",
  yesterday: "pages.dpilot.google.cm.presetYesterday",
  last_7: "pages.dpilot.google.cm.presetLast7",
  last_30: "pages.dpilot.google.cm.presetLast30",
  this_month: "pages.dpilot.google.cm.presetThisMonth",
  last_month: "pages.dpilot.google.cm.presetLastMonth",
};

function storageKey(projectId: string) {
  return `dclickora.gads.cm.prefs.${projectId}`;
}

function normalizePreset(raw: unknown): GoogleManagerPreset {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (PRESET_SET.has(s)) return s as GoogleManagerPreset;
  return DEFAULT.preset;
}

function normalizeCampaignFilter(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT.campaignFilter;
  const s = raw.trim();
  if (!s || s === "all") return GOOGLE_MANAGER_ALL_CAMPAIGNS;
  return s;
}

export function googleManagerPresetLabelKey(preset: string): MessageKey | null {
  if (PRESET_SET.has(preset)) return PRESET_I18N_KEYS[preset as GoogleManagerPreset];
  return null;
}

export function googleManagerPresetLabel(
  preset: string,
  t?: (key: MessageKey) => string,
): string {
  const key = googleManagerPresetLabelKey(preset);
  if (key && t) return t(key);
  if (PRESET_SET.has(preset)) return PRESET_LABELS[preset as GoogleManagerPreset];
  return preset;
}

export function readGoogleManagerPrefs(projectId: string): GoogleManagerPrefs {
  if (typeof window === "undefined" || !projectId) return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<GoogleManagerPrefs>;
    return {
      preset: normalizePreset(parsed.preset),
      campaignFilter: normalizeCampaignFilter(parsed.campaignFilter),
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeGoogleManagerPrefs(
  projectId: string,
  patch: Partial<GoogleManagerPrefs>,
): GoogleManagerPrefs {
  if (!projectId) return { ...DEFAULT };
  const cur = readGoogleManagerPrefs(projectId);
  const next: GoogleManagerPrefs = {
    preset: patch.preset != null ? normalizePreset(patch.preset) : cur.preset,
    campaignFilter:
      patch.campaignFilter != null
        ? normalizeCampaignFilter(patch.campaignFilter)
        : cur.campaignFilter,
  };
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

/**
 * Se o filtro aponta para uma campanha que já não existe na lista, volta a «Todas».
 * Evita Select Radix partido / listas vazias sem explicação.
 */
export function sanitizeCampaignFilter(
  campaignFilter: string,
  availableIds: Iterable<string>,
): string {
  const f = normalizeCampaignFilter(campaignFilter);
  if (f === GOOGLE_MANAGER_ALL_CAMPAIGNS) return f;
  const set = availableIds instanceof Set ? availableIds : new Set(availableIds);
  return set.has(f) ? f : GOOGLE_MANAGER_ALL_CAMPAIGNS;
}
