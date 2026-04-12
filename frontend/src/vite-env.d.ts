/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Se "true", em produção usa o URL *.railway.app em VITE_API_URL diretamente (sem proxy /api na Vercel). Requer CORS na API. */
  readonly VITE_API_DIRECT_RAILWAY?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  /** OAuth Web client ID (Google Cloud Console) — igual a GOOGLE_OAUTH_CLIENT_ID na API */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
