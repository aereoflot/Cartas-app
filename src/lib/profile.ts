import { supabase } from './supabase'

export interface MyProfile {
  id: string
  username: string
  displayName: string
  locale: string
  role: 'user' | 'moderator' | 'owner'
  hideAdult: boolean
}

/**
 * The signed-in user's own profile row. Created automatically by the
 * handle_new_user trigger the first time they sign in, so this may be queried
 * immediately after the first login.
 */
export async function fetchMyProfile(userId: string): Promise<MyProfile | null> {
  if (supabase === null) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, locale, role, hide_adult')
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
    hide_adult: boolean
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    locale: row.locale,
    role: row.role,
    hideAdult: row.hide_adult,
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
