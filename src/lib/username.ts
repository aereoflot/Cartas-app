/**
 * The same rule the database enforces (`^[a-z0-9_]{3,24}$` on profiles.username),
 * checked in the app so the person finds out while typing rather than on submit.
 * Kept here, away from React, so it can be tested on its own.
 */

export type UsernameProblem = 'too-short' | 'too-long' | 'bad-characters' | null

export const USERNAME_MIN = 3
export const USERNAME_MAX = 24

/** Lower-case, trimmed, spaces as underscores: what someone probably meant. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

export function checkUsername(value: string): UsernameProblem {
  const name = normalizeUsername(value)
  if (name.length < USERNAME_MIN) return 'too-short'
  if (name.length > USERNAME_MAX) return 'too-long'
  if (!/^[a-z0-9_]+$/.test(name)) return 'bad-characters'
  return null
}
