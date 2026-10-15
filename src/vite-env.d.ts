/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** "1" turns the expert on. Anything else shows the "working on it" notice. */
  readonly VITE_EXPERT_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
