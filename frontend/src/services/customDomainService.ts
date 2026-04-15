import { apiClient } from "@/lib/apiClient";
import type { CustomDomainDto, CustomDomainQuotaDto } from "@/types/api";

export const customDomainService = {
  list() {
    return apiClient.get<CustomDomainDto[]>("/custom-domain");
  },
  quota() {
    return apiClient.get<CustomDomainQuotaDto>("/custom-domain/quota");
  },
  create(hostname: string) {
    return apiClient.post<CustomDomainDto>("/custom-domain", {
      hostname,
    });
  },
  verify(id: string) {
    return apiClient.post<{ verified: boolean } & CustomDomainDto>(`/custom-domain/${encodeURIComponent(id)}/verify`, {});
  },
  setDefault(id: string) {
    return apiClient.patch<CustomDomainDto[]>(`/custom-domain/${encodeURIComponent(id)}/default`, {});
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
