import { useEffect, useSyncExternalStore } from 'react'
import type { SyncState } from '@/lib/sync'
import { startSync, stopSync, subscribeSync, syncState } from '@/lib/sync'
import { useSession } from './useSession'

/**
 * Runs the favourites/folders sync for as long as somebody is signed in.
 * Mounted once, high in the tree.
 */
export function useSync(): void {
  const { session } = useSession()
  const userId = session?.user.id

  useEffect(() => {
    if (userId === undefined) {
      stopSync()
      return
    }
    void startSync(userId)
    return () => stopSync()
  }, [userId])
}

/** For showing whether the account copy is up to date. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSync, syncState, syncState)
}
