/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  /** OAuth Web client ID (Google Cloud Console) — igual a GOOGLE_OAUTH_CLIENT_ID na API */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
