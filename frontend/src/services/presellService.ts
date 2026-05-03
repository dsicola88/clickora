import { apiClient } from "@/lib/apiClient";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import type { Presell } from "@/types/api";

export const presellService = {
  async getPublicById(id: string) {
    return apiClient.get<Presell>(`/public/presells/id/${encodeURIComponent(id)}`);
  },

  async getPublicBySlug(slug: string) {
    return apiClient.get<Presell>(`/public/presells/slug/${encodeURIComponent(slug)}`);
  },

  /** Raiz do domínio personalizado: id da presell publicada ligada a este domínio (Host). */
  async getRootPresellIdForHost() {
    return apiClient.get<{ id: string }>(`/public/custom-domain/root-presell`);
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
      import_mirror_src_doc?: string;
      discount_percent: number | null;
      discount_headline: string;
      social_proof: string;
      rating_value: string;
      rating_stars: number;
      urgency_timer_seconds: number;
      storefront_theme: "dark_commerce" | "default";
      storefront_hero_tint: boolean;
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

  /** Upload de imagem para o editor manual (galeria, imagem, depoimentos, etc.). */
  async uploadBuilderMedia(file: File) {
    const form = new FormData();
    form.append("image", file);
    const token = localStorage.getItem("clickora_token");
    const base = getApiBaseUrl().replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/presells/builder-media`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
      if (!res.ok) {
        return { data: null as { url: string } | null, error: body.error || `Erro ${res.status}` };
      }
      if (!body.url) {
        return { data: null, error: "Resposta inválida do servidor." };
      }
      return { data: { url: body.url }, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      return { data: null, error: msg };
    }
  },
};
