import { supabase } from './supabase'

/**
 * Passwordless sign-in: the user types an email and gets a link. No passwords to
 * forget, lose or leak. Supabase calls this an OTP; from the user's side it is
 * just "a link arrived".
 *
 * The redirect target must be listed in the Supabase dashboard under
 * Authentication → URL Configuration, or the link will bounce.
 */
export async function sendMagicLink(email: string): Promise<void> {
  if (supabase === null) throw new Error('supabase-not-configured')

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error !== null) throw new Error(error.message)
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
