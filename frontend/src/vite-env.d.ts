/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Legado: em dclickora.com a API já é direta. Só usar "true" para forçar proxy /api na Vercel. */
  readonly VITE_API_USE_VERCEL_PROXY?: string;
  readonly VITE_API_DIRECT_RAILWAY?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  /** OAuth Web client ID (Google Cloud Console) — igual a GOOGLE_OAUTH_CLIENT_ID na API */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
