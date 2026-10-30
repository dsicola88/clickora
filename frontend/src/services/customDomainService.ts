import { apiClient } from "@/lib/apiClient";
import type { CustomDomainDto, CustomDomainQuotaDto } from "@/types/api";

export const customDomainService = {
  list() {
    return apiClient.get<CustomDomainDto[]>("/custom-domain");
  },
  quota() {
    return apiClient.get<CustomDomainQuotaDto>("/custom-domain/quota");
  },
  create(hostname: string, purpose: "hosting" | "tracking" | "both" = "both") {
    return apiClient.post<CustomDomainDto>("/custom-domain", {
      hostname,
      purpose,
    });
  },
  verify(id: string) {
    return apiClient.post<{ verified: boolean } & CustomDomainDto>(`/custom-domain/${encodeURIComponent(id)}/verify`, {});
  },
  setDefault(id: string) {
    return apiClient.patch<CustomDomainDto[]>(`/custom-domain/${encodeURIComponent(id)}/default`, {});
  },
  setPurpose(id: string, purpose: "hosting" | "tracking" | "both") {
    return apiClient.patch<CustomDomainDto[]>(`/custom-domain/${encodeURIComponent(id)}/purpose`, {
      purpose,
    });
  },
  setDefaultTracking(id: string) {
    return apiClient.patch<CustomDomainDto[]>(
      `/custom-domain/${encodeURIComponent(id)}/default-tracking`,
      {},
    );
  },
  setRootPresell(domainId: string, presellId: string | null) {
    return apiClient.patch<CustomDomainDto[]>(`/custom-domain/${encodeURIComponent(domainId)}/root-presell`, {
      presell_id: presellId,
    });
  },
  remove(id: string) {
    return apiClient.delete<{ ok: boolean; domains: CustomDomainDto[] }>(`/custom-domain/${encodeURIComponent(id)}`);
  },
};
