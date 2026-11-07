/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_USE_MOCKS: string;
  /** Raíz de la página pública de resultados; vacía = la boleta no enlaza a resultados. */
  readonly VITE_PUBLIC_RESULTS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
