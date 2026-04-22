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
};
