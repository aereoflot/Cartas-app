import { supabase } from './supabase'

export interface MyProfile {
  id: string
  username: string
  displayName: string
  locale: string
  role: 'user' | 'moderator' | 'owner'
}

/**
 * The signed-in user's own profile row. Created automatically by the
 * handle_new_user trigger the first time they sign in, so this may be queried
 * immediately after the first login.
 *
 * It asks for no content preference and no birth date. Those live in
 * `profile_settings`, which only their owner can read — `profiles` is
 * world-readable, which is the point of it and the reason nothing personal goes
 * in it. Asking here for a column that moved is how this query spent a release
 * failing with `column profiles.hide_adult does not exist`, taking the whole
 * profile screen down with it.
 */
export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  if (supabase === null) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, locale, role')
    .eq('id', userId)
    .maybeSingle()

  if (error !== null) throw new Error(error.message)
  if (data === null) return null

  const row = data as {
    id: string
    username: string
    display_name: string
    locale: string
    role: MyProfile['role']
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    locale: row.locale,
    role: row.role,
  }
}

/**
 * Change your own handle and the name people see. `profiles.username` is unique
 * and case-insensitive, so a clash comes back as a specific error rather than a
 * raw Postgres message.
 */
export type ProfileSaveResult = 'saved' | 'taken' | 'invalid'

export async function updateMyProfile(
  userId: string,
  patch: { username?: string; displayName?: string },
): Promise<ProfileSaveResult> {
  if (supabase === null) return 'invalid'

  const row: Record<string, string> = {}
  if (patch.username !== undefined) row.username = patch.username
  if (patch.displayName !== undefined) row.display_name = patch.displayName

  const { error } = await supabase.from('profiles').update(row).eq('id', userId)
  if (error === null) return 'saved'
  // 23505 unique_violation: somebody already has that handle
  if (error.code === '23505') return 'taken'
  // 23514 check_violation: it did not match the shape the database accepts
  if (error.code === '23514') return 'invalid'
  throw new Error(error.message)
}

/* ------------------------------------------------------- private settings */

export interface MySettings {
  /** ISO `yyyy-mm-dd`, or null for an account made before it was asked. */
  birthdate: string | null
  /** The old 18+ preference. Only consulted when there is no birth date. */
  hideAdult: boolean
}

/**
 * The settings only their owner can see: the birth date the 18+ gate is
 * computed from, and the preference it replaced.
 *
 * A missing row is not an error. `profile_settings` has no trigger behind it,
 * so an account that has never saved a setting simply has no row, and the
 * honest answer is "no date, nothing hidden".
 */
export async function fetchMySettings(userId: string): Promise<MySettings> {
  if (supabase === null) return { birthdate: null, hideAdult: false }

  const { data, error } = await supabase
    .from('profile_settings')
    .select('birthdate, hide_adult')
    .eq('profile_id', userId)
    .maybeSingle()

  if (error !== null) throw new Error(error.message)
  if (data === null) return { birthdate: null, hideAdult: false }

  const row = data as { birthdate: string | null; hide_adult: boolean }
  return { birthdate: row.birthdate, hideAdult: row.hide_adult }
}

/** Write the settings row, creating it the first time. */
export async function saveMySettings(
  userId: string,
  patch: Partial<MySettings>,
): Promise<void> {
  if (supabase === null) return

  const row: Record<string, unknown> = { profile_id: userId }
  if (patch.birthdate !== undefined) row.birthdate = patch.birthdate
  if (patch.hideAdult !== undefined) row.hide_adult = patch.hideAdult

  const { error } = await supabase
    .from('profile_settings')
    .upsert(row, { onConflict: 'profile_id' })
  if (error !== null) throw new Error(error.message)
}
