import { useCallback, useEffect, useState } from "react";
import {
  GOOGLE_MANAGER_ALL_CAMPAIGNS,
  type GoogleManagerPreset,
  readGoogleManagerPrefs,
  sanitizeCampaignFilter,
  writeGoogleManagerPrefs,
} from "@/lib/googleManagerPrefs";

export { GOOGLE_MANAGER_ALL_CAMPAIGNS };

/** Período + filtro de campanha partilhados entre páginas do Campaign Manager. */
export function useGoogleManagerPrefs(projectId: string) {
  const [preset, setPresetState] = useState<GoogleManagerPreset>(() =>
    readGoogleManagerPrefs(projectId).preset,
  );
  const [campaignFilter, setCampaignFilterState] = useState(
    () => readGoogleManagerPrefs(projectId).campaignFilter,
  );

  useEffect(() => {
    if (!projectId) return;
    const p = readGoogleManagerPrefs(projectId);
    setPresetState(p.preset);
    setCampaignFilterState(p.campaignFilter);
  }, [projectId]);

  const setPreset = useCallback(
    (value: string) => {
      if (!projectId) return;
      const next = writeGoogleManagerPrefs(projectId, {
        preset: value as GoogleManagerPreset,
      });
      setPresetState(next.preset);
    },
    [projectId],
  );

  const setCampaignFilter = useCallback(
    (value: string) => {
      if (!projectId) return;
      const next = writeGoogleManagerPrefs(projectId, { campaignFilter: value });
      setCampaignFilterState(next.campaignFilter);
    },
    [projectId],
  );

  /** Limpa filtro se a campanha já não está na lista carregada. */
  const ensureCampaignFilterValid = useCallback(
    (availableIds: Iterable<string>) => {
      const cleaned = sanitizeCampaignFilter(campaignFilter, availableIds);
      if (cleaned !== campaignFilter) setCampaignFilter(cleaned);
      return cleaned;
    },
    [campaignFilter, setCampaignFilter],
  );

  return {
    preset,
    setPreset,
    campaignFilter,
    setCampaignFilter,
    ensureCampaignFilterValid,
  };
}
