import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Without env vars the app runs on the bundled sample catalogue, and says so in
 * the UI, so the whole thing is explorable before a Supabase project exists.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
