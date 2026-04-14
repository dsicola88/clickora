import { apiClient } from "@/lib/apiClient";
import type { CustomDomainDto } from "@/types/api";

export const customDomainService = {
  list() {
    return apiClient.get<CustomDomainDto[]>("/custom-domain");
  },
  create(hostname: string) {
    return apiClient.post<CustomDomainDto & { dns: { txt_name: string; txt_value: string } }>("/custom-domain", {
      hostname,
    });
  },
  verify(id: string) {
    return apiClient.post<{ verified: boolean } & CustomDomainDto>(`/custom-domain/${encodeURIComponent(id)}/verify`, {});
  },
  setDefault(id: string) {
    return apiClient.patch<CustomDomainDto[]>(`/custom-domain/${encodeURIComponent(id)}/default`, {});
  },
  remove(id: string) {
    return apiClient.delete<{ ok: boolean; domains: CustomDomainDto[] }>(`/custom-domain/${encodeURIComponent(id)}`);
  },
};
