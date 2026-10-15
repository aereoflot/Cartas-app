import { useSyncExternalStore } from 'react'
import { hidesAdultGames } from '@/lib/age'
import { useSession } from './useSession'
import {
  deckFolders,
  favoriteDecks,
  favoriteGames,
  friendGroups,
  groupMessages,
  hideAdult,
  ownedDecks,
  subscribe,
  type DeckFolder,
  type FriendGroup,
  type GroupMessage,
} from '@/lib/prefs'

export function useFavoriteGames(): string[] {
  return useSyncExternalStore(subscribe, favoriteGames, favoriteGames)
}

export function useFavoriteDecks(): string[] {
  return useSyncExternalStore(subscribe, favoriteDecks, favoriteDecks)
}

export function useOwnedDecks(): string[] {
  return useSyncExternalStore(subscribe, ownedDecks, ownedDecks)
}

export function useHideAdult(): boolean {
  return useSyncExternalStore(subscribe, hideAdult, hideAdult)
}

/**
 * Whether to hide adult games from whoever is using the app now.
 *
 * The birth date comes off the session that is already in memory — not a query
 * — so this stays synchronous and keeps working on a train, which is the whole
 * premise of the rest of this file. The durable copy lives in
 * `profile_settings`; this is the one the screens read.
 *
 * Signed out there is no date, so the old per-device preference decides.
 */
export function useHidesAdult(): boolean {
  const stored = useHideAdult()
  const { session } = useSession()
  const given = session?.user.user_metadata?.['birthdate']
  const birthdate = typeof given === 'string' ? given : null
  return hidesAdultGames(birthdate, stored, new Date())
}

export function useDeckFolders(): DeckFolder[] {
  return useSyncExternalStore(subscribe, deckFolders, deckFolders)
}

export function useFriendGroups(): FriendGroup[] {
  return useSyncExternalStore(subscribe, friendGroups, friendGroups)
}

export function useGroupMessages(groupId: string): GroupMessage[] {
  const read = () => groupMessages(groupId)
  return useSyncExternalStore(subscribe, read, read)
}
