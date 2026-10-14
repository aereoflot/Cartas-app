import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    // Tests run against the bundled sample catalogue, never the developer's
    // .env.local — otherwise a local Supabase project turns unit tests into
    // network tests. The Postgres path is covered by catalogue.test.ts (mappers)
    // and supabase/tests/ (the schema itself).
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    css: false,
  },
})
