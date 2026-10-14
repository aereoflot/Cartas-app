import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface SessionState {
  session: Session | null
  pending: boolean
}

/**
 * The current session, kept in step with Supabase. `pending` is true only while
 * the first check is in flight, so the UI does not flash "signed out" at someone
 * who is signed in.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    pending: supabase !== null,
  })

  useEffect(() => {
    if (supabase === null) return
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, pending: false })
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, pending: false })
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
