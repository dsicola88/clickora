import { apiClient } from "@/lib/apiClient";
import type { DomainRoutingEventDto, DomainRoutingRole, OfferDetailDto, OfferDto } from "@/types/api";

export type OfferInput = {
  name: string;
  network?: string | null;
  hoplink_url: string;
  backup_hoplink_url?: string | null;
  is_active?: boolean;
  run_probe?: boolean;
  domain_bindings?: Array<{
    custom_domain_id: string;
    role: DomainRoutingRole;
    priority?: number;
    is_active?: boolean;
  }>;
};

export const offersService = {
  list() {
    return apiClient.get<OfferDto[]>("/offers");
  },
  getById(id: string) {
    return apiClient.get<OfferDetailDto>(`/offers/${encodeURIComponent(id)}`);
  },
  create(payload: OfferInput) {
    return apiClient.post<OfferDto>("/offers", payload);
  },
  update(id: string, payload: Partial<OfferInput>) {
    return apiClient.patch<OfferDto>(`/offers/${encodeURIComponent(id)}`, payload);
  },
  remove(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/offers/${encodeURIComponent(id)}`);
  },
  validate(id: string, opts?: { skip_probe?: boolean }) {
    return apiClient.post<OfferDto>(`/offers/${encodeURIComponent(id)}/validate`, {
      skip_probe: opts?.skip_probe === true,
    });
  },
  setDomains(
    id: string,
    bindings: Array<{
      custom_domain_id: string;
      role: DomainRoutingRole;
      priority?: number;
      is_active?: boolean;
    }>,
  ) {
    return apiClient.put<OfferDto>(`/offers/${encodeURIComponent(id)}/domains`, { bindings });
  },
  events(id: string) {
    return apiClient.get<DomainRoutingEventDto[]>(`/offers/${encodeURIComponent(id)}/events`);
  },
  backfill() {
    return apiClient.post<{
      ok: boolean;
      offersCreated: number;
      presellsLinked: number;
      campaignsLinked: number;
      bindingsCreated: number;
    }>("/offers/backfill", {});
  },
};
