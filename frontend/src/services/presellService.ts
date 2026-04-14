import { apiClient } from "@/lib/apiClient";
import type { Presell } from "@/types/api";

export const presellService = {
  async getPublicById(id: string) {
    return apiClient.get<Presell>(`/public/presells/id/${encodeURIComponent(id)}`);
  },

  async getPublicBySlug(slug: string) {
    return apiClient.get<Presell>(`/public/presells/slug/${encodeURIComponent(slug)}`);
  },

  async getAll() {
    return apiClient.get<Presell[]>("/presells");
  },

  async getById(id: string) {
    return apiClient.get<Presell>(`/presells/${id}`);
  },

  async create(data: Partial<Presell>) {
    return apiClient.post<Presell>("/presells", data);
  },

  async importFromUrl(payload: { product_url: string; language?: string; affiliate_link?: string }) {
    return apiClient.post<{
      product_name: string;
      title: string;
      subtitle: string;
      sales_text: string;
      cta_text: string;
      images: string[];
      source_url: string;
      affiliate_link: string;
      video_url?: string;
      official_buy_cta: string;
      discount_percent: number | null;
      discount_headline: string;
      social_proof: string;
      rating_value: string;
      rating_stars: number;
      urgency_timer_seconds: number;
    }>("/presells/import-from-url", payload);
  },

  async update(id: string, data: Partial<Presell>) {
    return apiClient.put<Presell>(`/presells/${id}`, data);
  },

  async delete(id: string) {
    return apiClient.delete(`/presells/${id}`);
  },

  async duplicate(id: string) {
    return apiClient.post<Presell>(`/presells/${id}/duplicate`);
  },

  async toggleStatus(id: string, status: Presell["status"]) {
    return apiClient.patch(`/presells/${id}/status`, { status });
  },

  async getCount() {
    return apiClient.get<{ count: number }>("/presells/count");
  },
};
