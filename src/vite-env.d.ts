/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEON_AUTH_URL: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_APPLE_REDIRECT_URI?: string;
  readonly VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?: string;
  readonly VITE_PUBLIC_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
