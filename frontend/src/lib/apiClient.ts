const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem("clickora_token");
  }

  private getHeaders(extraHeaders?: Record<string, string>): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<{ data: T | null; error: string | null }> {
    const { method = "GET", body, headers } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: this.getHeaders(headers),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || errorData.error || `Erro ${response.status}`;

        if (response.status === 401) {
          localStorage.removeItem("clickora_token");
          localStorage.removeItem("clickora_user");
          window.dispatchEvent(new CustomEvent("auth:logout"));
        }

        return { data: null, error: message };
      }

      const data = await response.json().catch(() => null);
      return { data: data as T, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro de conexão com o servidor";
      return { data: null, error: message };
    }
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: "POST", body, headers });
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: "PUT", body });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: "PATCH", body });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  setToken(token: string) {
    localStorage.setItem("clickora_token", token);
  }

  clearToken() {
    localStorage.removeItem("clickora_token");
    localStorage.removeItem("clickora_user");
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
