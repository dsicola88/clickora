import { apiClient } from "@/lib/apiClient";
import { getApiBaseUrl } from "@/lib/apiOrigin";
import type { AuthResponse, LoginPayload, RegisterPayload, User } from "@/types/api";

export const authService = {
  async loginWithGoogle(idToken: string) {
    const result = await apiClient.post<AuthResponse>("/auth/google", { id_token: idToken });
    if (result.data?.token) {
      apiClient.setToken(result.data.token);
      localStorage.setItem("clickora_user", JSON.stringify(result.data.user));
    }
    return result;
  },

  async login(payload: LoginPayload) {
    const result = await apiClient.post<AuthResponse>("/auth/login", payload);
    if (result.data?.token) {
      apiClient.setToken(result.data.token);
      localStorage.setItem("clickora_user", JSON.stringify(result.data.user));
    }
    return result;
  },

  async register(payload: RegisterPayload) {
    const result = await apiClient.post<AuthResponse>("/auth/register", {
      ...payload,
      accept_policies: payload.accept_policies === true,
    });
    if (result.data?.token) {
      apiClient.setToken(result.data.token);
      localStorage.setItem("clickora_user", JSON.stringify(result.data.user));
    }
    return result;
  },

  async logout() {
    await apiClient.post("/auth/logout");
    apiClient.clearToken();
  },

  async me() {
    return apiClient.get<User>("/auth/me");
  },

  async patchProfile(body: { full_name?: string; avatar_url?: string | null }) {
    const result = await apiClient.patch<User>("/auth/me", body);
    if (result.data) {
      localStorage.setItem("clickora_user", JSON.stringify(result.data));
    }
    return result;
  },

  async changePassword(current_password: string, new_password: string) {
    return apiClient.post<{ message: string }>("/auth/change-password", { current_password, new_password });
  },

  async uploadAvatar(file: File) {
    const form = new FormData();
    form.append("avatar", file);
    const token = localStorage.getItem("clickora_token");
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; user?: User };
      if (!res.ok) {
        return { data: null, error: body.error || `Erro ${res.status}` };
      }
      if (body.user) {
        localStorage.setItem("clickora_user", JSON.stringify(body.user));
      }
      return { data: body, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro de rede";
      return { data: null, error: msg };
    }
  },

  async deleteAvatar() {
    const result = await apiClient.delete<{ ok: boolean; user: User }>("/auth/avatar");
    if (result.data?.user) {
      localStorage.setItem("clickora_user", JSON.stringify(result.data.user));
    }
    return result;
  },

  async resetPassword(email: string) {
    return apiClient.post("/auth/reset-password", { email });
  },

  async updatePassword(token: string, password: string) {
    return apiClient.post("/auth/update-password", { token, password });
  },

  async exportMyDataJson(): Promise<{ data: unknown | null; error: string | null }> {
    const token = localStorage.getItem("clickora_token");
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/me/data-export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        return { data: null, error: body.error || `Erro ${res.status}` };
      }
      return { data: body, error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Erro de rede" };
    }
  },

  async deleteAccount(password: string) {
    const result = await apiClient.post<{ message: string }>("/auth/me/delete-account", { password });
    if (!result.error && result.data) {
      apiClient.clearToken();
      localStorage.removeItem("clickora_user");
    }
    return result;
  },

  getStoredUser(): User | null {
    const raw = localStorage.getItem("clickora_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getToken(): string | null {
    return localStorage.getItem("clickora_token");
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
};
