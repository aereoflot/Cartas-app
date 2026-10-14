import { SignInError, classifySignInError } from './auth'
import { supabase } from './supabase'
import { normalizeUsername } from './username'

/**
 * Registration the ordinary way: a handle, an address and a password.
 *
 * An earlier version derived a fake address from the handle so that nobody had
 * to give a real one. Supabase rejects those outright — its validator wants a
 * real top-level domain, and `ana@cartas.invalid` is refused before anything
 * else happens — so the address is asked for instead of invented.
 *
 * Nothing is ever sent to it. Confirmation is off, which means signing up logs
 * you straight in: no email, no link, nothing that opens in the wrong browser.
 * The address sits in `auth.users` as the thing you sign in with, and as the
 * only thing that could ever recover a lost password.
 *
 * It is never copied into `profiles`, which anyone can read. Handles are
 * public; addresses are not, and that line is drawn in the schema rather than
 * in this file.
 *
 * Supabase Auth still does the dangerous parts: hashing, tokens, session
 * refresh, and the `auth.uid()` every row-level policy here is built on.
 */

/**
 * Eight, not six. Supabase's own minimum is a project setting and defaults to
 * six; this is checked here so the form can say so while someone is typing, but
 * the setting is what actually enforces it — raise it in the dashboard too,
 * because a rule only the client knows is not a rule.
 */
export const PASSWORD_MIN = 8

/** The handful that would otherwise be half the passwords in any database. */
const TOO_COMMON = [
  '12345678', '123456789', 'password', 'contrasena', 'qwertyui', 'iloveyou',
  '11111111', 'abc12345', 'baraja12', 'cartas12',
]

export type PasswordProblem = 'too-short' | 'too-common' | null

export function checkPassword(password: string): PasswordProblem {
  if (password.length < PASSWORD_MIN) return 'too-short'
  if (TOO_COMMON.includes(password.toLowerCase())) return 'too-common'
  return null
}

/** The shape of an address, loosely: the server decides, this only guides. */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim()
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(trimmed)
}

/**
 * Is this handle free? `profiles` is readable by anyone, which is what makes
 * the answer available before an account exists.
 *
 * This does tell a stranger which handles are taken. That is the same thing any
 * "this name is unavailable" message tells them, and the alternative — finding
 * out only after filling in a password — is worse for everybody who is not
 * harvesting names.
 */
export async function isUsernameFree(username: string): Promise<boolean> {
  if (supabase === null) return true
  const name = normalizeUsername(username)

  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', name)
    .maybeSingle()

  if (error !== null) throw new SignInError(classifySignInError(error), error.message)
  return data === null
}

function fail(error: { message: string; status?: number }): never {
  throw new SignInError(classifySignInError(error), error.message)
}

/**
 * Create an account. The handle travels in the user's metadata, where the
 * `handle_new_user` trigger picks it up for the profile row.
 *
 * Two different uniqueness rules, both the database's: the address is unique in
 * `auth.users`, and the handle is unique in `profiles`. The check in the form is
 * a courtesy — it tells somebody before they choose a password — and the
 * constraint is what actually decides.
 *
 * This requires email confirmation to be off in the project. With it on,
 * Supabase tries to send a confirmation and the account cannot sign in until
 * somebody clicks a link that was never wanted.
 */
export async function signUp(
  username: string,
  email: string,
  password: string,
): Promise<void> {
  if (supabase === null) throw new SignInError('unknown', 'supabase-not-configured')

  const name = normalizeUsername(username)
  const { error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username: name } },
  })
  if (error !== null) fail(error)
}

export async function signIn(email: string, password: string): Promise<void> {
  if (supabase === null) throw new SignInError('unknown', 'supabase-not-configured')

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error !== null) fail(error)
}

/**
 * Change a password, current one first.
 *
 * Supabase would accept the new password on the strength of the session alone.
 * Asking for the current one anyway means a borrowed phone cannot be turned
 * into a permanent takeover in two taps — and with no email, a stolen password
 * is unrecoverable, so this is the cheapest lock worth fitting.
 */
export async function changePassword(
  email: string,
  current: string,
  next: string,
): Promise<void> {
  if (supabase === null) throw new SignInError('unknown', 'supabase-not-configured')

  const { error: wrong } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: current,
  })
  if (wrong !== null) fail(wrong)

  const { error } = await supabase.auth.updateUser({ password: next })
  if (error !== null) fail(error)
}
