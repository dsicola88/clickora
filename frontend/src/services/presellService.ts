import { apiClient } from "@/lib/apiClient";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import type { Presell } from "@/types/api";

export type PresellComplianceResultDto = {
  ruleId: string;
  name: string;
  description: string;
  platforms: Array<"google" | "microsoft">;
  category: string;
  severity: string;
  status: "PASS" | "FAIL" | "WARNING" | "NOT_CHECKED";
  confidence: number;
  evidence: { summary: string; details?: string[]; excerpt?: string };
  remediation: string;
  sourceIds: string[];
  sourceReviewedAt: string;
};

export type PresellComplianceAuditDto = {
  id: string;
  rules_version: string;
  gate: string;
  google_gate: string;
  microsoft_gate: string;
  content_fingerprint: string;
  results: PresellComplianceResultDto[];
  disclaimer: string;
  created_at: string;
};

export type PresellComplianceStateDto = {
  disclaimer: string;
  compliance_gate: string;
  last_compliance_audit_at: string | null;
  last_compliance_audit_id: string | null;
  content_fingerprint: string | null;
  status: string;
  latest_audit: PresellComplianceAuditDto | null;
  decisions: Array<{
    id: string;
    audit_id: string;
    rule_id: string;
    decision: string;
    reason: string;
    decided_by_user_id: string;
    created_at: string;
  }>;
};

export const presellService = {
  async getPublicById(id: string) {
    return apiClient.get<Presell>(`/public/presells/id/${encodeURIComponent(id)}`);
  },

  async getPublicBySlug(slug: string) {
    return apiClient.get<Presell>(`/public/presells/slug/${encodeURIComponent(slug)}`);
  },

  /** Raiz do domínio personalizado: id da presell publicada ligada a este domínio (Host). */
  async getRootPresellIdForHost() {
    return apiClient.get<{
      id: string | null;
      purpose?: string;
      code?: string;
      message?: string;
    }>(`/public/custom-domain/root-presell`);
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

  async importFromUrl(payload: {
    product_url: string;
    language?: string;
    affiliate_link?: string;
    generation_niche?: "black" | "white";
  }) {
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
      rating_from_source: boolean;
      rating_value: string;
      rating_stars: number;
      urgency_timer_seconds: number;
      import_notes: string[];
      import_mode: "mirror" | "template" | "incomplete";
      publishable: boolean;
      storefront_theme: "dark_commerce" | "default";
      storefront_hero_tint: boolean;
      generation_niche: "black" | "white";
      policy_urls: {
        privacy?: string;
        terms?: string;
        refund?: string;
        shipping?: string;
      };
      source_business_name?: string;
      source_contact_email?: string;
      source_page_title?: string;
      favicon_url?: string;
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

  async getCompliance(id: string) {
    return apiClient.get<PresellComplianceStateDto>(`/presells/${id}/compliance`);
  },

  async runComplianceAudit(id: string, opts?: { skip_probe?: boolean }) {
    return apiClient.post<{
      disclaimer: string;
      audit_id: string;
      evaluation: {
        rules_version: string;
        evaluated_at: string;
        gate: string;
        google: unknown;
        microsoft: unknown;
        results: PresellComplianceResultDto[];
        content_fingerprint: string;
        disclaimer: string;
      };
      suggestions: unknown[];
    }>(`/presells/${id}/compliance/audit`, { skip_probe: opts?.skip_probe === true });
  },

  async submitComplianceDecision(
    id: string,
    body: {
      audit_id: string;
      rule_id: string;
      decision: "override_pass" | "acknowledge" | "dispute";
      reason: string;
    },
  ) {
    return apiClient.post<{
      decision: { id: string; rule_id: string; decision: string; created_at: string };
      latest_audit: PresellComplianceAuditDto | null;
      disclaimer: string;
    }>(`/presells/${id}/compliance/decisions`, body);
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
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
        storage?: "r2" | "local";
      };
      if (!res.ok) {
        return { data: null as { url: string; storage?: "r2" | "local" } | null, error: body.error || `Erro ${res.status}` };
      }
      if (!body.url) {
        return { data: null, error: "Resposta inválida do servidor." };
      }
      return { data: { url: body.url, storage: body.storage }, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      return { data: null, error: msg };
    }
  },
};
