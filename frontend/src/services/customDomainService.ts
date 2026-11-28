import { apiClient } from "@/lib/apiClient";
import type {
  CustomDomainDto,
  CustomDomainQuotaDto,
  DomainRoutingEventDto,
  DomainRoutingRole,
} from "@/types/api";

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

  /** Probe Vercel + HTTPS (poll enquanto SSL a provisionar). */
  goLive(id: string) {
    return apiClient.get<CustomDomainDto>(`/custom-domain/${encodeURIComponent(id)}/go-live`);
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
  healthCheck(id: string) {
    return apiClient.post<{
      check: { ok: boolean; healthStatus: string; httpStatus: number | null; error: string | null };
      domain: CustomDomainDto;
    }>(`/custom-domain/${encodeURIComponent(id)}/health-check`, {});
  },
  setActive(id: string, isActive: boolean, reason?: string) {
    return apiClient.patch<CustomDomainDto[]>(`/custom-domain/${encodeURIComponent(id)}/active`, {
      is_active: isActive,
      ...(reason ? { reason } : {}),
    });
  },
  setRouting(
    id: string,
    payload: { routing_role?: DomainRoutingRole; auto_recover?: boolean; routing_priority?: number },
  ) {
    return apiClient.patch<CustomDomainDto[]>(
      `/custom-domain/${encodeURIComponent(id)}/routing`,
      payload,
    );
  },
  promotePrimary(id: string, reason?: string) {
    return apiClient.post<{
      ok: boolean;
      previousDomainId: string | null;
      targetDomainId: string;
      domains: CustomDomainDto[];
    }>(`/custom-domain/${encodeURIComponent(id)}/promote-primary`, reason ? { reason } : {});
  },
  rollbackPrimary(reason?: string) {
    return apiClient.post<{
      ok: boolean;
      previousDomainId: string | null;
      targetDomainId: string;
      domains: CustomDomainDto[];
    }>("/custom-domain/rollback-primary", reason ? { reason } : {});
  },
  routingEvents(params?: { domain_id?: string; presell_id?: string; offer_id?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.domain_id) q.set("domain_id", params.domain_id);
    if (params?.presell_id) q.set("presell_id", params.presell_id);
    if (params?.offer_id) q.set("offer_id", params.offer_id);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiClient.get<Array<DomainRoutingEventDto & {
      custom_domain?: { id: string; hostname: string } | null;
      previous_domain?: { id: string; hostname: string } | null;
      target_domain?: { id: string; hostname: string } | null;
      presell?: { id: string; title: string; slug: string } | null;
      offer?: { id: string; name: string } | null;
    }>>(`/custom-domain/routing-events${qs ? `?${qs}` : ""}`);
  },
  remove(id: string) {
    return apiClient.delete<{ ok: boolean; domains: CustomDomainDto[] }>(`/custom-domain/${encodeURIComponent(id)}`);
  },
};
