import { supabase } from './supabase'

/**
 * Why a sign-in attempt failed, in terms the person in front of the screen can
 * act on. Supabase answers in English prose aimed at developers — "email rate
 * limit exceeded" — and putting that on screen tells somebody their email is
 * broken when in fact they just have to wait.
 */
export type SignInProblem =
  | 'rateLimit'
  | 'invalidEmail'
  | 'offline'
  | 'usernameTaken'
  | 'weakPassword'
  | 'wrongLogin'
  | 'unknown'

export class SignInError extends Error {
  constructor(
    readonly problem: SignInProblem,
    /** The original wording, kept for the error log and for us. */
    readonly detail: string,
  ) {
    super(detail)
    this.name = 'SignInError'
  }
}

/**
 * Exported for the tests: the mapping is the part worth pinning down.
 *
 * Takes the shape both error types share, because the same wording comes back
 * from Auth (`AuthError`) and from a table read (`PostgrestError`), and only
 * one of them carries a status.
 */
export function classifySignInError(error: {
  message: string
  status?: number | undefined
}): SignInProblem {
  const code = (error as { code?: string }).code ?? ''
  const message = error.message

  // The built-in email service is capped per hour, and there is a separate
  // cooldown per address. Both come back as 429.
  if (error.status === 429 || code.includes('rate_limit') || /rate limit/i.test(message)) {
    return 'rateLimit'
  }
  // Wrong handle and wrong password come back identically, on purpose: telling
  // somebody which half they got right is how account lists get harvested.
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'wrongLogin'
  }
  if (code === 'user_already_exists' || /already registered|already exists/i.test(message)) {
    return 'usernameTaken'
  }
  if (code === 'weak_password' || /password should be|password is too/i.test(message)) {
    return 'weakPassword'
  }
  if (code === 'validation_failed' || /invalid.*email|email.*invalid/i.test(message)) {
    return 'invalidEmail'
  }
  if (/fetch|network|timeout/i.test(message)) return 'offline'
  return 'unknown'
}

/**
 * Sign-in by emailed link. No longer reachable from the UI: the link opens in
 * whatever browser the mail app prefers — Gmail's own viewer, usually — and the
 * session then lives in that browser instead of the one the person was using,
 * which for an installed app means it appears not to have worked at all.
 *
 * Kept because it is the only path that could ever recover a lost password, and
 * accounts have no email today. See `account.ts`.
 */
export async function sendMagicLink(email: string): Promise<void> {
  if (supabase === null) throw new Error('supabase-not-configured')

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error !== null) throw new SignInError(classifySignInError(error), error.message)
}

export async function signOut(): Promise<void> {
  if (supabase === null) return
  await supabase.auth.signOut()
}

/**
 * Delete this account and everything personal in it. The server does the
 * deleting (it needs a key no browser may hold); this clears what the device
 * kept and signs out, so nothing of theirs is left sitting on the phone either.
 */
export async function deleteMyAccount(): Promise<void> {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (supabase === null || url === undefined || url === '') throw new Error('no-backend')

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token === undefined) throw new Error('sign-in-required')

  const response = await fetch(`${url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(await response.text())

  clearLocalData()
  await supabase.auth.signOut()
}

/** Everything this app keeps on the device, gone. */
export function clearLocalData(): void {
  try {
    const mine = Object.keys(window.localStorage).filter((key) => key.startsWith('cartas.'))
    for (const key of mine) window.localStorage.removeItem(key)
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
