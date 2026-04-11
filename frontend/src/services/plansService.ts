import { apiClient } from "@/lib/apiClient";
import type { Plan } from "@/types/api";

export const plansService = {
  async getAll() {
    return apiClient.get<Plan[]>("/plans");
  },

  async subscribe(planId: string) {
    return apiClient.post<{ checkout_url?: string }>("/plans/subscribe", { plan_id: planId });
  },

  async cancel() {
    return apiClient.post("/plans/cancel");
  },
};
