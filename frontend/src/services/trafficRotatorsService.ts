import { apiClient } from "@/lib/apiClient";

export type TrafficRotatorMode = "random" | "weighted" | "sequential" | "fill_order";
export type RotatorDeviceRule = "all" | "mobile" | "desktop";

export type TrafficRotatorArmDto = {
  id: string;
  destination_url: string;
  label: string | null;
  order_index: number;
  weight: number;
  max_clicks: number | null;
  clicks_delivered: number;
  countries_allow: string[] | null;
  countries_deny: string[] | null;
  device_rule: RotatorDeviceRule;
};

export type TrafficRotatorDto = {
  id: string;
  name: string;
  slug: string;
  mode: TrafficRotatorMode;
  backup_url: string | null;
  context_presell_id: string;
  sequence_cursor: number;
  access_code_set: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  arms: TrafficRotatorArmDto[];
  public_click_url: string;
};

export type TrafficRotatorArmInput = {
  destination_url: string;
  label?: string | null;
  order_index: number;
  weight?: number;
  max_clicks?: number | null;
  countries_allow?: string[] | null;
  countries_deny?: string[] | null;
  device_rule?: RotatorDeviceRule;
};

export type CreateTrafficRotatorBody = {
  name: string;
  slug: string;
  mode: TrafficRotatorMode;
  backup_url?: string | null;
  context_presell_id: string;
  access_code?: string | null;
  is_active?: boolean;
  arms: TrafficRotatorArmInput[];
};

export type RotatorAbArmStats = {
  arm_id: string;
  label: string | null;
  order_index: number;
  current_weight: number;
  clicks: number;
  conversions: number;
  revenue: string;
  conversion_rate: number;
};

export type RotatorAbStatsResponse = {
  rotator_id: string;
  lookback_from: string;
  arms: RotatorAbArmStats[];
};

export const trafficRotatorsService = {
  list() {
    return apiClient.get<TrafficRotatorDto[]>("/traffic-rotators");
  },

  get(id: string) {
    return apiClient.get<TrafficRotatorDto>(`/traffic-rotators/${encodeURIComponent(id)}`);
  },

  create(body: CreateTrafficRotatorBody) {
    return apiClient.post<TrafficRotatorDto>("/traffic-rotators", body);
  },

  update(id: string, body: Partial<CreateTrafficRotatorBody> & { access_code?: string }) {
    return apiClient.patch<TrafficRotatorDto>(`/traffic-rotators/${encodeURIComponent(id)}`, body);
  },

  remove(id: string) {
    return apiClient.delete<unknown>(`/traffic-rotators/${encodeURIComponent(id)}`);
  },

  abStats(id: string, params?: { lookback_days?: number }) {
    const q = new URLSearchParams();
    if (params?.lookback_days != null) q.set("lookback_days", String(params.lookback_days));
    const suffix = q.toString() ? `?${q.toString()}` : "";
    return apiClient.get<RotatorAbStatsResponse>(`/traffic-rotators/${encodeURIComponent(id)}/ab-stats${suffix}`);
  },

  promoteWinner(
    id: string,
    body: { metric?: "conversion_rate" | "revenue"; lookback_days?: number; min_clicks_per_arm?: number },
  ) {
    return apiClient.post<{
      ok: true;
      winner_arm_id: string;
      winner_label: string | null;
      metric: string;
      summary: { candidates_evaluated: number; lookback_from: string };
    }>(`/traffic-rotators/${encodeURIComponent(id)}/promote-winner`, body);
  },
};
