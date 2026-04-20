import { getResolvedPublicApiBaseUrl } from "@/config/publicApiUrl";

const API_BASE_URL = getResolvedPublicApiBaseUrl();

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

  /** GET sem `Content-Type: json` — para CSV e outros binários. */
  private getAuthHeaders(accept = "text/csv, application/json;q=0.5, */*;q=0.1"): HeadersInit {
    const headers: Record<string, string> = { Accept: accept };
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      /** Cancela o pedido (ex.: timeout em operações lentas como envio SMTP). */
      signal?: AbortSignal;
    } = {}
  ): Promise<{ data: T | null; error: string | null }> {
    const { method = "GET", body, headers, signal } = options;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: this.getHeaders(headers),
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });

      if (!response.ok) {
        if (response.status === 502 || response.status === 504) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
          const fromBody = errorData.error || errorData.message;
          return {
            data: null,
            error:
              fromBody ||
              "O pedido expirou no proxy (Vercel → API). Tente «Verificar» de novo; se persistir, defina VITE_PUBLIC_API_URL no build com o URL direto da API (Railway …/api) para contornar o proxy, ou confirme que o serviço na Railway está em execução.",
          };
        }
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
          details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        };
        let message = errorData.message || errorData.error || `Erro ${response.status}`;
        const fe = errorData.details?.fieldErrors;
        if (fe && typeof fe === "object") {
          const parts = Object.entries(fe).flatMap(([key, msgs]) =>
            Array.isArray(msgs) ? msgs.map((m) => `${key}: ${m}`) : [],
          );
          if (parts.length) message = `${message} (${parts.join("; ")})`;
        }

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
      const aborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (aborted) {
        return {
          data: null,
          error:
            "Pedido cancelado ou expirou (timeout). Verifique se a API responde ou tente de novo dentro de instantes.",
        };
      }
      const message = err instanceof Error ? err.message : "Erro de conexão com o servidor";
      return { data: null, error: message };
    }
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "GET" });
  }

  /**
   * Resposta bruta (ex.: CSV). Em erro, tenta JSON para a mensagem.
   */
  async getBlob(endpoint: string): Promise<{
    data: Blob | null;
    filename: string | null;
    /** Próxima página em exportações CSV paginadas (base64url). */
    nextCursor: string | null;
    error: string | null;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "GET",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        const message = errorData.message || errorData.error || `Erro ${response.status}`;
        if (response.status === 401) {
          localStorage.removeItem("clickora_token");
          localStorage.removeItem("clickora_user");
          window.dispatchEvent(new CustomEvent("auth:logout"));
        }
        return { data: null, filename: null, nextCursor: null, error: message };
      }

      const cd = response.headers.get("Content-Disposition");
      let filename: string | null = null;
      if (cd) {
        const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
        const plain = /filename="([^"]+)"/i.exec(cd) || /filename=([^;\s]+)/i.exec(cd);
        const raw = star?.[1]?.trim() || plain?.[1]?.trim();
        if (raw) {
          try {
            filename = decodeURIComponent(raw.replace(/^["']|["']$/g, ""));
          } catch {
            filename = raw.replace(/^["']|["']$/g, "");
          }
        }
      }

      const nextCursor = response.headers.get("X-Next-Cursor");
      const blob = await response.blob();
      return { data: blob, filename, nextCursor, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro de conexão com o servidor";
      return { data: null, filename: null, nextCursor: null, error: message };
    }
  }

  post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>, signal?: AbortSignal) {
    return this.request<T>(endpoint, { method: "POST", body, headers, signal });
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
