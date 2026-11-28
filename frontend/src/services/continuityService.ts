import { apiClient } from "@/lib/apiClient";
import type { ContinuityOverviewDto } from "@/types/api";

export const CONTINUITY_SCHEMA_PENDING = "CONTINUITY_SCHEMA_PENDING";

export const continuityService = {
  getOverview() {
    return apiClient.get<ContinuityOverviewDto>("/continuity/overview");
  },
};
